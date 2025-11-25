import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Target, TrendingUp } from "lucide-react";

interface StatsOverviewProps {
  userId?: string;
  refreshTrigger?: number;
}

export const StatsOverview = ({ userId, refreshTrigger }: StatsOverviewProps) => {
  const [stats, setStats] = useState({
    totalHabits: 0,
    activeHabits: 0,
    totalStreak: 0,
    todayCompleted: 0,
    todayTotal: 0
  });

  const fetchStats = async () => {
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0];
    
    const { data: habits } = await supabase
      .from('habits')
      .select('*, habit_logs(*)')
      .eq('user_id', userId);

    if (!habits) return;

    const totalHabits = habits.length;
    const activeHabits = habits.filter(h => !h.end_date || new Date(h.end_date) >= new Date()).length;
    const totalStreak = habits.reduce((sum, h) => sum + (h.current_streak || 0), 0);

    const todayHabits = habits.filter(h => {
      const startDate = new Date(h.start_date);
      return startDate <= new Date(today);
    });

    const todayLogs = todayHabits.map(h => 
      h.habit_logs?.find((log: any) => log.log_date === today)
    );

    const todayCompleted = todayLogs.filter(log => log?.status === 'done').length;

    setStats({
      totalHabits,
      activeHabits,
      totalStreak,
      todayCompleted,
      todayTotal: todayHabits.length
    });
  };

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('stats-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs' }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refreshTrigger]);

  const todayPercentage = stats.todayTotal > 0 
    ? Math.round((stats.todayCompleted / stats.todayTotal) * 100) 
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="bg-gradient-card border-border shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Habits</p>
              <p className="text-3xl font-bold">{stats.activeHabits}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-warning/10 rounded-lg">
              <Flame className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Streak</p>
              <p className="text-3xl font-bold">{stats.totalStreak}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <TrendingUp className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-3xl font-bold">{todayPercentage}%</p>
              <p className="text-xs text-muted-foreground">
                {stats.todayCompleted}/{stats.todayTotal} complete
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};