import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface WeeklyStreakTableProps {
  userId?: string;
  refreshTrigger?: number;
}

export const WeeklyStreakTable = ({ userId, refreshTrigger }: WeeklyStreakTableProps) => {
  const [tableData, setTableData] = useState<any[]>([]);
  const [dates, setDates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const fetchData = async () => {
    if (!userId) return;
    
    setLoading(true);
    
    try {
      const { data: habits } = await supabase
        .from('habits')
        .select('*, habit_logs(*), categories(name)')
        .eq('user_id', userId);

      if (!habits) return;

      // Get last 7 days
      const last7Days = [];
      const today = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last7Days.push({
          date: date,
          dateStr: date.toISOString().split('T')[0],
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNum: date.getDate()
        });
      }

      setDates(last7Days);

      // Build table data
      const data = habits.map(habit => {
        const row: any = {
          id: habit.id,
          name: habit.name,
          category: habit.categories?.name || 'Uncategorized',
          streak: habit.current_streak || 0,
          days: []
        };

        last7Days.forEach(({ date, dateStr }) => {
          const scheduled = isScheduledForDate(habit, date);
          const log = habit.habit_logs?.find((l: any) => l.log_date === dateStr);
          
          row.days.push({
            date: dateStr,
            scheduled,
            status: log?.status || (scheduled ? 'pending' : 'not-scheduled')
          });
        });

        return row;
      });

      setTableData(data);
    } catch (error) {
      console.error("Error fetching table data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId, refreshTrigger]);

  const getStatusIcon = (status: string) => {
    const baseClass = "w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full";
    
    const statusConfig = {
      'done': {
        icon: "✓",
        bg: "bg-green-500/20",
        text: "text-green-700 dark:text-green-400"
      },
      'missed': {
        icon: "✗",
        bg: "bg-red-500/20",
        text: "text-red-700 dark:text-red-400"
      },
      'skipped': {
        icon: "○",
        bg: "bg-yellow-500/20",
        text: "text-yellow-700 dark:text-yellow-400"
      },
      'pending': {
        icon: "-",
        bg: "bg-muted",
        text: "text-muted-foreground"
      },
      'not-scheduled': {
        icon: "-",
        bg: "bg-muted/30",
        text: "text-muted-foreground/50"
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge className={`${baseClass} ${config.bg} ${config.text} text-xs sm:text-sm font-medium`}>
        {config.icon}
      </Badge>
    );
  };

  // Mobile condensed view
  const MobileView = () => (
    <div className="space-y-4 sm:hidden">
      {tableData.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No habits to display
        </div>
      ) : (
        tableData.slice(0, 3).map((row) => (
          <Card key={row.id} className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-medium text-sm truncate">{row.name}</h4>
                <Badge variant="outline" className="text-xs mt-1">
                  {row.category}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Flame className="w-4 h-4 text-warning" />
                <span className="font-bold text-sm">{row.streak}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {dates.map((d, idx) => {
                const dayStatus = row.days[idx]?.status || 'not-scheduled';
                const isToday = idx === dates.length - 1;
                
                return (
                  <div key={idx} className="flex flex-col items-center">
                    <div className="text-xs text-muted-foreground mb-1">
                      {d.day.charAt(0)}
                    </div>
                    <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs ${
                      isToday ? 'ring-2 ring-primary' : ''
                    }`}>
                      {getStatusIcon(dayStatus)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {d.dayNum}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))
      )}
      {tableData.length > 3 && (
        <p className="text-center text-sm text-muted-foreground">
          +{tableData.length - 3} more habits
        </p>
      )}
    </div>
  );

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">Weekly Progress</CardTitle>
        <CardDescription className="text-sm sm:text-base">
          7-day habit completion overview
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mobile View */}
        <MobileView />
        
        {/* Desktop/Tablet View */}
        <div className="hidden sm:block">
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="min-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px] sm:min-w-[150px] lg:min-w-[180px]">
                      <span className="text-sm sm:text-base">Habit</span>
                    </TableHead>
                    <TableHead className="min-w-[80px] sm:min-w-[100px]">
                      <span className="text-sm sm:text-base">Category</span>
                    </TableHead>
                    <TableHead className="text-center min-w-[60px]">
                      <span className="text-sm sm:text-base">Streak</span>
                    </TableHead>
                    {dates.map((d, idx) => (
                      <TableHead key={idx} className="text-center min-w-[50px] sm:min-w-[60px]">
                        <div className="flex flex-col items-center">
                          <div className="text-xs font-medium">{d.day}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {d.dayNum}
                          </div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={dates.length + 3} className="text-center py-8">
                        <div className="flex items-center justify-center">
                          <div className="animate-pulse">Loading...</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : tableData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={dates.length + 3} className="text-center py-8 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Minus className="w-8 h-8 opacity-50" />
                          <p>No habits to display</p>
                          <p className="text-sm">Create your first habit to see progress</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableData.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">
                          <div className="truncate max-w-[150px] lg:max-w-[200px] text-sm sm:text-base">
                            {row.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {row.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Flame className="w-4 h-4 text-warning" />
                            <span className="font-bold text-sm sm:text-base">{row.streak}</span>
                          </div>
                        </TableCell>
                        {row.days.map((day: any, idx: number) => (
                          <TableCell key={idx} className="text-center">
                            <div className="flex justify-center">
                              {getStatusIcon(day.status)}
                            </div>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        
        {/* Legend for mobile */}
        <div className="mt-6 border-t pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-green-700 dark:text-green-400 text-xs">✓</span>
              </div>
              <span>Done</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-700 dark:text-red-400 text-xs">✗</span>
              </div>
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <span className="text-yellow-700 dark:text-yellow-400 text-xs">○</span>
              </div>
              <span>Skipped</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                <span className="text-muted-foreground text-xs">-</span>
              </div>
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-muted/30 flex items-center justify-center">
                <span className="text-muted-foreground/50 text-xs">-</span>
              </div>
              <span>Not Scheduled</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};