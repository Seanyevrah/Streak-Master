import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Minus, Flame, Trash2, Pencil, Calendar, AlertCircle, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface HabitListProps {
  userId?: string;
  onUpdate?: () => void;
  refreshTrigger?: number;
  onEditHabit?: (habit: any) => void;
}

type SortOption = 'schedule' | 'completion' | 'created';

export const HabitList = ({ userId, onUpdate, refreshTrigger, onEditHabit }: HabitListProps) => {
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('schedule');
  const [expandedHabits, setExpandedHabits] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'done' | 'skipped' | 'missed' | 'delete';
    habitId: string;
    habitName: string;
  }>({
    open: false,
    type: 'done',
    habitId: '',
    habitName: ''
  });

  const fetchHabits = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('habits')
      .select(`*, categories(name), habit_logs(*)`)
      .eq('user_id', userId);

    if (error) {
      toast.error("Failed to load habits");
      return;
    }

    setHabits(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchHabits();

    const channel = supabase
      .channel('habits-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, fetchHabits)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs' }, fetchHabits)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshTrigger]);

  const isScheduledForDate = (habit: any, date: Date): boolean => {
    const habitDate = new Date(habit.start_date);
    habitDate.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    if (habitDate > checkDate) return false;
    
    if (habit.end_date) {
      const endDate = new Date(habit.end_date);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < checkDate) return false;
    }

    if (habit.frequency === 'weekdays' && habit.weekdays) {
      return habit.weekdays.includes(checkDate.getDay());
    }

    if (habit.frequency === 'weekly') {
      // For weekly habits, check if it's the same day of the week as start date
      return checkDate.getDay() === habitDate.getDay();
    }

    return true;
  };

  const getTodayStatus = (habit: any) => {
    const today = new Date().toISOString().split('T')[0];
    return habit.habit_logs?.find((log: any) => log.log_date === today)?.status || 'pending';
  };

  const isOverdue = (habit: any): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!isScheduledForDate(habit, today)) return false;
    
    const status = getTodayStatus(habit);
    return status === 'pending';
  };

  const getCompletionPercentage = (habit: any) => {
    const logs = habit.habit_logs || [];
    
    const startDate = new Date(habit.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledDays = [];
    
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const checkDate = new Date(d);
      if (isScheduledForDate(habit, checkDate)) {
        scheduledDays.push(checkDate.toISOString().split('T')[0]);
      }
    }
    
    const doneCount = logs.filter((log: any) => 
      log.status === 'done' && scheduledDays.includes(log.log_date)
    ).length;
    
    return scheduledDays.length > 0 ? Math.round((doneCount / scheduledDays.length) * 100) : 0;
  };

  const getLast7Days = (habit: any) => {
    const result = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const scheduled = isScheduledForDate(habit, date);
      const log = habit.habit_logs?.find((l: any) => l.log_date === dateStr);
      
      result.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        scheduled,
        status: log?.status || (scheduled ? 'pending' : 'not-scheduled')
      });
    }
    
    return result;
  };

  const sortHabits = (habitsToSort: any[]) => {
    switch (sortBy) {
      case 'schedule':
        return [...habitsToSort].sort((a, b) => {
          const aScheduled = isScheduledForDate(a, new Date());
          const bScheduled = isScheduledForDate(b, new Date());
          const aOverdue = isOverdue(a);
          const bOverdue = isOverdue(b);
          
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          if (aScheduled && !bScheduled) return -1;
          if (!aScheduled && bScheduled) return 1;
          return 0;
        });
      
      case 'completion':
        return [...habitsToSort].sort((a, b) => {
          const aComp = getCompletionPercentage(a);
          const bComp = getCompletionPercentage(b);
          return aComp - bComp;
        });
      
      case 'created':
      default:
        return [...habitsToSort].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  };

  const calculateStreak = (habit: any) => {
    const logs = habit.habit_logs?.sort((a: any, b: any) => 
      new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
    ) || [];

    // For weekly habits, count consecutive weeks
    if (habit.frequency === 'weekly') {
      return calculateWeeklyStreak(habit, logs);
    }

    // For weekday-specific habits, count consecutive scheduled days
    if (habit.frequency === 'weekdays') {
      return calculateWeekdayStreak(habit, logs);
    }

    // For daily habits, count consecutive days
    return calculateDailyStreak(habit, logs);
  };

  const calculateDailyStreak = (habit: any, logs: any[]) => {
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const logDate = new Date(log.log_date);
      logDate.setHours(0, 0, 0, 0);

      if (!isScheduledForDate(habit, logDate)) {
        continue;
      }

      if (log.status === 'done') {
        streak++;
      } else if (log.status === 'missed') {
        break;
      } else if (log.status === 'skipped') {
        // Skipped days don't break the streak but don't count towards it either
        continue;
      }
    }

    return streak;
  };

  const calculateWeeklyStreak = (habit: any, logs: any[]) => {
    const habitStartDate = new Date(habit.start_date);
    habitStartDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentWeekStart = new Date(today);
    
    // Find the start of the current week (based on habit's start day)
    const habitStartDay = habitStartDate.getDay();
    const daysSinceHabitStartDay = (today.getDay() - habitStartDay + 7) % 7;
    currentWeekStart.setDate(today.getDate() - daysSinceHabitStartDay);
    currentWeekStart.setHours(0, 0, 0, 0);

    // Sort logs by date descending
    const sortedLogs = [...logs].sort((a, b) => 
      new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
    );

    // Check weeks backwards from current week
    while (currentWeekStart >= habitStartDate) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      // Check if there's a "done" log in this week
      const hasDoneThisWeek = sortedLogs.some(log => {
        const logDate = new Date(log.log_date);
        logDate.setHours(0, 0, 0, 0);
        return (
          logDate >= currentWeekStart &&
          logDate <= weekEnd &&
          log.status === 'done' &&
          isScheduledForDate(habit, logDate)
        );
      });

      if (hasDoneThisWeek) {
        streak++;
      } else {
        // Check if this week is the current week and it's still ongoing
        const isCurrentWeek = currentWeekStart <= today && weekEnd >= today;
        if (!isCurrentWeek) {
          break; // Break streak if a past week has no completion
        }
      }

      // Move to previous week
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    }

    return streak;
  };

  const calculateWeekdayStreak = (habit: any, logs: any[]) => {
    if (!habit.weekdays || habit.weekdays.length === 0) return 0;

    const sortedLogs = [...logs].sort((a, b) => 
      new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the most recent scheduled day that should be checked
    let currentCheckDate = new Date(today);
    
    // Go backwards through time to find consecutive scheduled days marked "done"
    while (true) {
      // Check if current date is scheduled for this habit
      const isScheduled = isScheduledForDate(habit, currentCheckDate);
      
      if (isScheduled) {
        const dateStr = currentCheckDate.toISOString().split('T')[0];
        const log = sortedLogs.find(l => l.log_date === dateStr);
        
        if (log && log.status === 'done') {
          streak++;
        } else {
          // If it's today and not logged yet, don't break the streak
          if (currentCheckDate.getTime() === today.getTime() && !log) {
            // Today is scheduled but not logged yet - don't break streak
            break;
          } else {
            // Found a scheduled day without completion - break streak
            break;
          }
        }
      } else {
        // Not a scheduled day - skip it (don't break streak)
      }

      // Move to previous day
      currentCheckDate.setDate(currentCheckDate.getDate() - 1);
      
      // Stop if we've gone before the habit start date
      const habitStartDate = new Date(habit.start_date);
      habitStartDate.setHours(0, 0, 0, 0);
      if (currentCheckDate < habitStartDate) {
        break;
      }
    }

    return streak;
  };

  const markHabit = async (habitId: string, status: 'done' | 'skipped' | 'missed') => {
    const today = new Date().toISOString().split('T')[0];
    const habit = habits.find(h => h.id === habitId);

    if (!habit) return;

    // Check if habit is scheduled for today
    if (!isScheduledForDate(habit, new Date())) {
      toast.error("This habit is not scheduled for today.");
      return;
    }

    const todayLog = habit.habit_logs?.find((log: any) => log.log_date === today);
    
    if (todayLog) {
      toast.error("You've already logged this habit today. You can only log once per day.");
      return;
    }

    const { error: logError } = await supabase
      .from('habit_logs')
      .insert({
        habit_id: habitId,
        log_date: today,
        status
      });

    if (logError) {
      toast.error("Failed to update habit");
      return;
    }

    // Recalculate streak after logging
    const { data: updatedHabit } = await supabase
      .from('habits')
      .select(`*, habit_logs(*)`)
      .eq('id', habitId)
      .single();

    if (updatedHabit) {
      const newStreak = calculateStreak(updatedHabit);

      await supabase
        .from('habits')
        .update({ current_streak: newStreak })
        .eq('id', habitId);

      if (userId) {
        const { data: allHabits } = await supabase
          .from('habits')
          .select('current_streak')
          .eq('user_id', userId);

        if (allHabits) {
          const totalStreak = allHabits.reduce((sum, h) => sum + (h.current_streak || 0), 0);
          
          await supabase
            .from('profiles')
            .update({ total_streak: totalStreak })
            .eq('id', userId);
        }
      }
    }

    await fetchHabits();
    onUpdate?.();

    const messages = {
      done: `Great job! Habit completed for today! 🔥`,
      skipped: 'Habit skipped for today.',
      missed: 'Habit marked as missed.'
    };

    toast.success(messages[status]);
  };

  const deleteHabit = async (habitId: string) => {
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', habitId);

    if (error) {
      toast.error("Failed to delete habit");
    } else {
      toast.success("Habit deleted successfully");
      await fetchHabits();
      onUpdate?.();
    }
  };

  const handleConfirm = async () => {
    if (confirmDialog.type === 'delete') {
      await deleteHabit(confirmDialog.habitId);
    } else {
      await markHabit(confirmDialog.habitId, confirmDialog.type);
    }
    setConfirmDialog({ ...confirmDialog, open: false });
  };

  const openConfirmDialog = (type: 'done' | 'skipped' | 'missed' | 'delete', habitId: string, habitName: string) => {
    setConfirmDialog({ open: true, type, habitId, habitName });
  };

  const toggleExpanded = (habitId: string) => {
    setExpandedHabits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(habitId)) {
        newSet.delete(habitId);
      } else {
        newSet.add(habitId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      'done': <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs">✓</Badge>,
      'missed': <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 text-xs">✗</Badge>,
      'skipped': <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">○</Badge>,
      'pending': <Badge variant="outline" className="text-xs">-</Badge>,
      'not-scheduled': <Badge variant="secondary" className="opacity-30 text-xs">-</Badge>
    };
    return badges[status as keyof typeof badges] || null;
  };

  const getDialogContent = () => {
    const { type, habitName } = confirmDialog;
    
    const content = {
      done: {
        title: "Mark as Done?",
        description: `Complete "${habitName}" for today? This will increase your streak!`,
        action: "Mark Done",
        destructive: false
      },
      skipped: {
        title: "Skip Habit?",
        description: `Skip "${habitName}" for today? Note: Skipping doesn't break your streak, but won't count toward it.`,
        action: "Skip",
        destructive: false
      },
      missed: {
        title: "Mark as Missed?",
        description: `Mark "${habitName}" as missed? Warning: This will reset your streak to 0.`,
        action: "Mark Missed",
        destructive: true
      },
      delete: {
        title: "Delete Habit?",
        description: `Are you sure you want to delete "${habitName}"? This action cannot be undone and all logs will be lost.`,
        action: "Delete",
        destructive: true
      }
    };

    return content[type];
  };

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading habits...</div>;
  }

  if (habits.length === 0) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No habits yet. Create your first habit to get started!</p>
        </CardContent>
      </Card>
    );
  }

  const sortedHabits = sortHabits(habits);
  const dialogContent = getDialogContent();

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="schedule">By Schedule</SelectItem>
            <SelectItem value="completion">By Completion %</SelectItem>
            <SelectItem value="created">By Date Created</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40">
        {sortedHabits.map((habit) => {
          const todayStatus = getTodayStatus(habit);
          const completion = getCompletionPercentage(habit);
          const hasLoggedToday = todayStatus !== 'pending';
          const overdue = isOverdue(habit);
          const last7Days = getLast7Days(habit);
          const isExpanded = expandedHabits.has(habit.id);
          
          return (
            <Card key={habit.id} className={`bg-gradient-card border-border shadow-card ${overdue ? 'border-l-4 border-l-destructive' : ''}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-xl">{habit.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {habit.categories?.name || 'Uncategorized'}
                      </Badge>
                      {overdue && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-warning" />
                        <span className="font-bold text-foreground">{habit.current_streak}</span> streak
                      </div>
                      <div>
                        <span className="font-bold text-foreground">{completion}%</span> complete
                      </div>
                      <div className="text-xs">
                        {habit.frequency === 'weekdays' ? 'Weekdays' : habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}
                      </div>
                    </div>
                    <Progress value={completion} className="h-2 mt-2" />
                    {hasLoggedToday && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Already logged for today - come back tomorrow!
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEditHabit?.(habit)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openConfirmDialog('delete', habit.id, habit.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => openConfirmDialog('done', habit.id, habit.name)}
                    variant={todayStatus === 'done' ? 'default' : 'outline'}
                    className={todayStatus === 'done' ? 'bg-gradient-success' : ''}
                    size="sm"
                    disabled={hasLoggedToday}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Done
                  </Button>
                  <Button
                    onClick={() => openConfirmDialog('skipped', habit.id, habit.name)}
                    variant={todayStatus === 'skipped' ? 'default' : 'outline'}
                    className={todayStatus === 'skipped' ? 'bg-warning' : ''}
                    size="sm"
                    disabled={hasLoggedToday}
                  >
                    <Minus className="w-4 h-4 mr-1" />
                    Skip
                  </Button>
                  <Button
                    onClick={() => openConfirmDialog('missed', habit.id, habit.name)}
                    variant={todayStatus === 'missed' ? 'destructive' : 'outline'}
                    size="sm"
                    disabled={hasLoggedToday}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Miss
                  </Button>
                </div>

                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(habit.id)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full">
                      <Calendar className="w-4 h-4 mr-2" />
                      {isExpanded ? 'Hide' : 'Show'} Last 7 Days
                      <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="grid grid-cols-7 gap-2">
                        {last7Days.map((day, idx) => (
                          <div key={idx} className="text-center">
                            <div className="text-xs text-muted-foreground mb-1">{day.dayName}</div>
                            <div className="text-xs text-muted-foreground mb-1">{day.dayNum}</div>
                            <div className="flex justify-center">
                              {getStatusBadge(day.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-border flex justify-around text-xs">
                        <div className="flex items-center gap-1">
                          <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 text-xs">✓</Badge>
                          <span className="text-muted-foreground">Done</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 text-xs">✗</Badge>
                          <span className="text-muted-foreground">Missed</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">○</Badge>
                          <span className="text-muted-foreground">Skipped</span>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={dialogContent.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {dialogContent.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};