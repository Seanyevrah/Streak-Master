import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Minus, Flame, Trash2, Pencil, Calendar, AlertCircle, ChevronDown, MoreVertical, Filter, Loader2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const [processingHabit, setProcessingHabit] = useState<string | null>(null);

  const fetchHabits = async () => {
    if (!userId) return;

    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('habits')
        .select(`*, categories(name), habit_logs(*)`)
        .eq('user_id', userId);

      if (error) {
        toast.error("Failed to load habits");
        return;
      }

      setHabits(data || []);
    } catch (error) {
      console.error("Error fetching habits:", error);
      toast.error("Failed to load habits");
    } finally {
      setLoading(false);
    }
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
        dayShort: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
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
    return habit.current_streak || 0;
  };

  const markHabit = async (habitId: string, status: 'done' | 'skipped' | 'missed') => {
    setProcessingHabit(habitId);
    
    try {
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
        const newStreak = status === 'done' ? (habit.current_streak || 0) + 1 : 
                         status === 'missed' ? 0 : 
                         (habit.current_streak || 0);

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
    } finally {
      setProcessingHabit(null);
    }
  };

  const deleteHabit = async (habitId: string) => {
    setProcessingHabit(habitId);
    
    try {
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
    } finally {
      setProcessingHabit(null);
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
      'done': <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-700 dark:text-green-400 text-xs">✓</div>,
      'missed': <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-700 dark:text-red-400 text-xs">✗</div>,
      'skipped': <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-700 dark:text-yellow-400 text-xs">○</div>,
      'pending': <div className="w-6 h-6 rounded-full border border-muted flex items-center justify-center text-xs">-</div>,
      'not-scheduled': <div className="w-6 h-6 rounded-full bg-muted/30 flex items-center justify-center text-xs text-muted-foreground/50">-</div>
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

  // Loading Skeletons
  const LoadingSkeleton = () => (
    <div className="space-y-3 sm:space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-gradient-card border-border shadow-card animate-pulse">
          <CardContent className="p-4 sm:p-6">
            {/* Header Skeleton */}
            <div className="flex justify-between items-start mb-3 sm:mb-4">
              <div className="flex-1">
                <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-1/4"></div>
              </div>
              <div className="flex gap-1">
                <div className="h-8 w-8 bg-muted rounded"></div>
                <div className="h-8 w-8 bg-muted rounded"></div>
              </div>
            </div>

            {/* Stats Skeleton */}
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-12"></div>
              </div>
              <div className="h-4 bg-muted rounded w-16"></div>
              <div className="h-6 bg-muted rounded w-20"></div>
            </div>

            {/* Progress Bar Skeleton */}
            <div className="h-2 bg-muted rounded-full mb-3 sm:mb-4"></div>

            {/* Action Buttons Skeleton */}
            <div className="grid grid-cols-3 gap-2 mb-3 sm:mb-4">
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
            </div>

            {/* 7-Day History Skeleton */}
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div key={day} className="flex flex-col items-center">
                    <div className="h-3 bg-muted rounded w-6 mb-1"></div>
                    <div className="h-3 bg-muted rounded w-4 mb-1"></div>
                    <div className="h-6 w-6 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Mobile Actions Sheet
  const MobileActionsSheet = ({ habit }: { habit: any }) => (
    <Sheet open={isMobileActionsOpen} onOpenChange={setIsMobileActionsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>{habit.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-2">
          <Button
            onClick={() => {
              setIsMobileActionsOpen(false);
              openConfirmDialog('done', habit.id, habit.name);
            }}
            variant="default"
            className="w-full bg-green-500 hover:bg-green-600"
            disabled={processingHabit === habit.id}
          >
            {processingHabit === habit.id ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Mark as Done
          </Button>
          <Button
            onClick={() => {
              setIsMobileActionsOpen(false);
              openConfirmDialog('skipped', habit.id, habit.name);
            }}
            variant="outline"
            className="w-full"
            disabled={processingHabit === habit.id}
          >
            {processingHabit === habit.id ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Minus className="w-4 h-4 mr-2" />
            )}
            Skip
          </Button>
          <Button
            onClick={() => {
              setIsMobileActionsOpen(false);
              openConfirmDialog('missed', habit.id, habit.name);
            }}
            variant="outline"
            className="w-full text-destructive border-destructive hover:bg-destructive/10"
            disabled={processingHabit === habit.id}
          >
            {processingHabit === habit.id ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <X className="w-4 h-4 mr-2" />
            )}
            Mark as Missed
          </Button>
          <div className="pt-4 border-t">
            <Button
              onClick={() => {
                setIsMobileActionsOpen(false);
                onEditHabit?.(habit);
              }}
              variant="ghost"
              className="w-full"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit Habit
            </Button>
            <Button
              onClick={() => {
                setIsMobileActionsOpen(false);
                openConfirmDialog('delete', habit.id, habit.name);
              }}
              variant="ghost"
              className="w-full text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Habit
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Mobile habit card view
  const MobileHabitCard = ({ habit }: { habit: any }) => {
    const todayStatus = getTodayStatus(habit);
    const completion = getCompletionPercentage(habit);
    const hasLoggedToday = todayStatus !== 'pending';
    const overdue = isOverdue(habit);
    const last7Days = getLast7Days(habit);
    const isExpanded = expandedHabits.has(habit.id);
    
    return (
      <Card key={habit.id} className={`bg-gradient-card border-border shadow-card ${overdue ? 'border-l-4 border-l-destructive' : ''}`}>
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base truncate">{habit.name}</h3>
                {overdue && (
                  <Badge variant="destructive" size="sm">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Overdue
                  </Badge>
                )}
              </div>
              <Badge variant="outline" size="sm" className="mb-2">
                {habit.categories?.name || 'Uncategorized'}
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEditHabit?.(habit)}
                className="h-8 w-8"
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <MobileActionsSheet habit={habit} />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between mb-3 text-sm">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-warning" />
              <span className="font-bold">{habit.current_streak}</span>
              <span className="text-muted-foreground">streak</span>
            </div>
            <div>
              <span className="font-bold">{completion}%</span>
              <span className="text-muted-foreground"> complete</span>
            </div>
            <Badge variant="secondary" size="sm">
              {habit.frequency === 'weekdays' ? 'Weekdays' : habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}
            </Badge>
          </div>

          {/* Progress */}
          <Progress value={completion} className="h-2 mb-3" />

          {/* Quick Actions */}
          {hasLoggedToday ? (
            <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30 rounded-lg">
              Already logged for today
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Button
                onClick={() => openConfirmDialog('done', habit.id, habit.name)}
                variant="outline"
                size="sm"
                className="text-green-600 border-green-200 hover:bg-green-50 h-10"
                disabled={processingHabit === habit.id}
              >
                {processingHabit === habit.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Done
                  </>
                )}
              </Button>
              <Button
                onClick={() => openConfirmDialog('skipped', habit.id, habit.name)}
                variant="outline"
                size="sm"
                className="text-yellow-600 border-yellow-200 hover:bg-yellow-50 h-10"
                disabled={processingHabit === habit.id}
              >
                {processingHabit === habit.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Minus className="w-4 h-4 mr-1" />
                    Skip
                  </>
                )}
              </Button>
              <Button
                onClick={() => openConfirmDialog('missed', habit.id, habit.name)}
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 h-10"
                disabled={processingHabit === habit.id}
              >
                {processingHabit === habit.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <X className="w-4 h-4 mr-1" />
                    Miss
                  </>
                )}
              </Button>
            </div>
          )}

          {/* 7-Day History */}
          <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(habit.id)}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full h-9">
                <Calendar className="w-4 h-4 mr-2" />
                {isExpanded ? 'Hide' : 'Show'} 7-Day History
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {last7Days.map((day, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="text-xs text-muted-foreground mb-1">{day.dayShort}</div>
                      <div className="text-xs text-muted-foreground mb-1">{day.dayNum}</div>
                      <div className="flex justify-center">
                        {getStatusBadge(day.status)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1 text-xs pt-2 border-t border-border">
                  <div className="flex items-center gap-1 justify-center">
                    <div className="w-3 h-3 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-xs">✓</div>
                    <span>Done</span>
                  </div>
                  <div className="flex items-center gap-1 justify-center">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 flex items-center justify-center text-red-600 text-xs">✗</div>
                    <span>Missed</span>
                  </div>
                  <div className="flex items-center gap-1 justify-center">
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-600 text-xs">○</div>
                    <span>Skipped</span>
                  </div>
                  <div className="flex items-center gap-1 justify-center">
                    <div className="w-3 h-3 rounded-full border border-muted flex items-center justify-center text-xs">-</div>
                    <span>Pending</span>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    );
  };

  // Desktop habit card (original with improvements)
  const DesktopHabitCard = ({ habit }: { habit: any }) => {
    const todayStatus = getTodayStatus(habit);
    const completion = getCompletionPercentage(habit);
    const hasLoggedToday = todayStatus !== 'pending';
    const overdue = isOverdue(habit);
    const last7Days = getLast7Days(habit);
    const isExpanded = expandedHabits.has(habit.id);
    
    return (
      <Card key={habit.id} className={`bg-gradient-card border-border shadow-card ${overdue ? 'border-l-4 border-l-destructive' : ''}`}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-xl">{habit.name}</CardTitle>
                <Badge variant="outline" className="text-sm">
                  {habit.categories?.name || 'Uncategorized'}
                </Badge>
                {overdue && (
                  <Badge variant="destructive" className="text-sm">
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
                <div className="text-sm">
                  {habit.frequency === 'weekdays' ? 'Weekdays' : habit.frequency.charAt(0).toUpperCase() + habit.frequency.slice(1)}
                </div>
              </div>
              <Progress value={completion} className="h-2 mt-3" />
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
              disabled={hasLoggedToday || processingHabit === habit.id}
            >
              {processingHabit === habit.id ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-1" />
              )}
              Done
            </Button>
            <Button
              onClick={() => openConfirmDialog('skipped', habit.id, habit.name)}
              variant={todayStatus === 'skipped' ? 'default' : 'outline'}
              className={todayStatus === 'skipped' ? 'bg-warning' : ''}
              size="sm"
              disabled={hasLoggedToday || processingHabit === habit.id}
            >
              {processingHabit === habit.id ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Minus className="w-4 h-4 mr-1" />
              )}
              Skip
            </Button>
            <Button
              onClick={() => openConfirmDialog('missed', habit.id, habit.name)}
              variant={todayStatus === 'missed' ? 'destructive' : 'outline'}
              size="sm"
              disabled={hasLoggedToday || processingHabit === habit.id}
            >
              {processingHabit === habit.id ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-1" />
              )}
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
                    <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-xs">✓</div>
                    <span className="text-muted-foreground">Done</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center text-red-600 text-xs">✗</div>
                    <span className="text-muted-foreground">Missed</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-600 text-xs">○</div>
                    <span className="text-muted-foreground">Skipped</span>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Sort Controls Loading */}
        <div className="flex justify-between items-center mb-4 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <div className="w-4 h-4 bg-muted rounded"></div>
            </div>
            <div className="w-[140px] sm:w-[180px] h-10 bg-muted rounded"></div>
          </div>
          <div className="hidden sm:block">
            <div className="w-24 h-6 bg-muted rounded"></div>
          </div>
        </div>

        {/* Mobile Counter Loading */}
        <div className="sm:hidden mb-4 animate-pulse">
          <div className="w-20 h-6 bg-muted rounded"></div>
        </div>

        {/* Loading Skeletons */}
        <LoadingSkeleton />
      </div>
    );
  }

  if (habits.length === 0) {
    return (
      <Card className="bg-gradient-card border-border">
        <CardContent className="py-12 text-center">
          <div className="max-w-sm mx-auto">
            <Flame className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <CardTitle className="mb-2">No habits yet</CardTitle>
            <CardDescription className="mb-6">
              Create your first habit to start building streaks and achieving your goals!
            </CardDescription>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedHabits = sortHabits(habits);
  const dialogContent = getDialogContent();

  return (
    <>
      {/* Sort Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground hidden sm:block" />
          <Select value={sortBy} onValueChange={(v: SortOption) => setSortBy(v)}>
            <SelectTrigger className="w-[140px] sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="schedule">By Schedule</SelectItem>
              <SelectItem value="completion">By Completion %</SelectItem>
              <SelectItem value="created">By Date Created</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="text-sm hidden sm:inline-flex">
          {sortedHabits.length} {sortedHabits.length === 1 ? 'habit' : 'habits'}
        </Badge>
      </div>

      {/* Mobile Counter */}
      <div className="sm:hidden mb-4">
        <Badge variant="secondary" className="text-sm">
          {sortedHabits.length} {sortedHabits.length === 1 ? 'habit' : 'habits'}
        </Badge>
      </div>

      {/* Habits List */}
      <div className="space-y-3 sm:space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40">
        {sortedHabits.map((habit) => (
          <>
            {/* Mobile View */}
            <div className="md:hidden">
              <MobileHabitCard key={`mobile-${habit.id}`} habit={habit} />
            </div>
            {/* Desktop View */}
            <div className="hidden md:block">
              <DesktopHabitCard key={`desktop-${habit.id}`} habit={habit} />
            </div>
          </>
        ))}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {dialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mt-2 sm:mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={dialogContent.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              disabled={processingHabit === confirmDialog.habitId}
            >
              {processingHabit === confirmDialog.habitId ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {dialogContent.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};