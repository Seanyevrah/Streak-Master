import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface WeeklyStreakChartProps {
  userId?: string;
  refreshTrigger?: number;
}

export const WeeklyStreakChart = ({ userId, refreshTrigger }: WeeklyStreakChartProps) => {
  const [chartData, setChartData] = useState<any[]>([]);

  const fetchData = async () => {
    if (!userId) return;

    const { data: habits } = await supabase
      .from('habits')
      .select('*, habit_logs(*)')
      .eq('user_id', userId);

    if (!habits) return;

    // Get last 7 days
    const last7Days = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let totalScheduled = 0;
      let totalCompleted = 0;

      habits.forEach(habit => {
        const habitDate = new Date(habit.start_date);
        if (habitDate <= date) {
          // Check if scheduled for this day
          let scheduled = true;
          
          if (habit.end_date) {
            const endDate = new Date(habit.end_date);
            if (endDate < date) scheduled = false;
          }

          if (scheduled && habit.frequency === 'weekdays' && habit.weekdays) {
            scheduled = habit.weekdays.includes(date.getDay());
          }

          if (scheduled && habit.frequency === 'weekly') {
            scheduled = date.getDay() === habitDate.getDay();
          }

          if (scheduled) {
            totalScheduled++;
            const log = habit.habit_logs?.find((l: any) => l.log_date === dateStr);
            if (log?.status === 'done') {
              totalCompleted++;
            }
          }
        }
      });

      const percentage = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

      last7Days.push({
        date: dateStr,
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        completed: totalCompleted,
        scheduled: totalScheduled,
        percentage
      });
    }

    setChartData(last7Days);
  };

  useEffect(() => {
    fetchData();
  }, [userId, refreshTrigger]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{payload[0].payload.day}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].payload.completed}/{payload[0].payload.scheduled} completed
          </p>
          <p className="text-sm font-bold text-primary">
            {payload[0].value}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle>7-Day Completion Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="day" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              label={{ value: '%', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.percentage === 100 ? 'hsl(var(--success))' : entry.percentage >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};