import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface WeeklyStreakTableProps {
  userId?: string;
  refreshTrigger?: number;
}

export const WeeklyStreakTable = ({ userId, refreshTrigger }: WeeklyStreakTableProps) => {
  const [tableData, setTableData] = useState<any[]>([]);
  const [dates, setDates] = useState<any[]>([]);

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
  };

  useEffect(() => {
    fetchData();
  }, [userId, refreshTrigger]);

  const getStatusIcon = (status: string) => {
    const icons = {
      'done': <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 w-8 h-8 flex items-center justify-center">✓</Badge>,
      'missed': <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 w-8 h-8 flex items-center justify-center">✗</Badge>,
      'skipped': <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 w-8 h-8 flex items-center justify-center">○</Badge>,
      'pending': <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">-</Badge>,
      'not-scheduled': <Badge variant="secondary" className="opacity-30 w-8 h-8 flex items-center justify-center">-</Badge>
    };
    return icons[status as keyof typeof icons] || null;
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle>7-Day Streak Table</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Habit</TableHead>
                <TableHead className="min-w-[100px]">Category</TableHead>
                <TableHead className="text-center">Streak</TableHead>
                {dates.map((d, idx) => (
                  <TableHead key={idx} className="text-center min-w-[60px]">
                    <div className="text-xs">{d.day}</div>
                    <div className="text-xs text-muted-foreground">{d.dayNum}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={dates.length + 3} className="text-center text-muted-foreground">
                    No habits to display
                  </TableCell>
                </TableRow>
              ) : (
                tableData.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {row.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-bold">{row.streak}</span>
                      </div>
                    </TableCell>
                    {row.days.map((day: any, idx: number) => (
                      <TableCell key={idx} className="text-center">
                        {getStatusIcon(day.status)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};