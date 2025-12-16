import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Flame, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

interface RecentActivityProps {
  userId?: string;
  refreshTrigger?: number;
}

type ActivityType = 'completion' | 'streak' | 'milestone' | 'created';

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
  habitId?: string;
  streak?: number;
}

// Type for the joined habit data
interface JoinedHabit {
  id: string;
  name: string;
  user_id: string;
  categories?: {
    name: string;
  };
}

// Type for habit log with joined habit
interface HabitLogWithHabit {
  id: string;
  status: string;
  created_at: string;
  log_date: string;
  habits: JoinedHabit | null;
}

export const RecentActivity = ({ userId, refreshTrigger }: RecentActivityProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentActivity = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch habit completions with proper join
      const { data: completions, error: completionsError } = await supabase
        .from('habit_logs')
        .select(`
          id,
          status,
          created_at,
          log_date,
          habits!inner (
            id,
            name,
            user_id,
            categories (
              name
            )
          )
        `)
        .eq('habits.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (completionsError) {
        console.error("Completions error:", completionsError);
        throw completionsError;
      }

      // Fetch user's profile for streak info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('total_streak, updated_at')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error("Profile error:", profileError);
        // Don't throw here, just log - profile might not exist yet
      }

      // Fetch user's habits to get creation activity
      const { data: recentHabits, error: habitsError } = await supabase
        .from('habits')
        .select('id, name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (habitsError) {
        console.error("Habits error:", habitsError);
        throw habitsError;
      }

      // Combine all activities
      const allActivities: ActivityItem[] = [];

      // Add habit completions
      const typedCompletions = completions as unknown as HabitLogWithHabit[];
      if (typedCompletions && typedCompletions.length > 0) {
        typedCompletions.forEach(completion => {
          const status = completion.status;
          const habit = completion.habits;
          
          if (!habit) return;

          const statusConfig = {
            done: { icon: '✓', color: 'green', verb: 'completed' },
            skipped: { icon: '⭕', color: 'yellow', verb: 'skipped' },
            missed: { icon: '✗', color: 'red', verb: 'missed' }
          }[status] || { icon: '📝', color: 'gray', verb: 'logged' };

          allActivities.push({
            id: `completion-${completion.id}`,
            type: 'completion',
            title: habit.name,
            description: `${statusConfig.verb.charAt(0).toUpperCase() + statusConfig.verb.slice(1)} "${habit.name}" on ${format(new Date(completion.log_date), 'MMM d')}`,
            timestamp: completion.created_at,
            icon: statusConfig.icon,
            color: statusConfig.color,
            habitId: habit.id
          });
        });
      }

      // Add streak milestones from profile updates
      if (profile && profile.total_streak && profile.updated_at) {
        // Check if streak is a milestone number
        const milestoneNumbers = [7, 14, 21, 30, 60, 90, 100, 180, 365];
        if (milestoneNumbers.includes(profile.total_streak)) {
          allActivities.push({
            id: `milestone-${profile.total_streak}`,
            type: 'milestone',
            title: `🎉 ${profile.total_streak} Day Streak!`,
            description: `Reached ${profile.total_streak} consecutive days!`,
            timestamp: profile.updated_at,
            icon: '🔥',
            color: 'orange',
            streak: profile.total_streak
          });
        }

        // Add current streak status
        if (profile.total_streak > 0) {
          allActivities.push({
            id: `streak-${profile.updated_at}`,
            type: 'streak',
            title: `Current Streak: ${profile.total_streak} days`,
            description: 'Keep up the great work!',
            timestamp: profile.updated_at,
            icon: '⚡',
            color: 'purple',
            streak: profile.total_streak
          });
        }
      }

      // Add habit creations
      if (recentHabits && recentHabits.length > 0) {
        recentHabits.forEach(habit => {
          allActivities.push({
            id: `created-${habit.id}`,
            type: 'created',
            title: `New Habit: ${habit.name}`,
            description: 'Started tracking this habit',
            timestamp: habit.created_at,
            icon: '➕',
            color: 'blue',
            habitId: habit.id
          });
        });
      }

      // Sort by timestamp and take only 10 most recent
      const sortedActivities = allActivities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      setActivities(sortedActivities);
    } catch (err) {
      console.error("Error fetching recent activity:", err);
      setError("Failed to load recent activity");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivity();

    // Set up real-time subscriptions
    const channels = [
      supabase
        .channel('habit-logs-activity')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'habit_logs'
          },
          () => {
            fetchRecentActivity();
          }
        )
        .subscribe(),

      supabase
        .channel('habits-activity')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'habits',
            filter: `user_id=eq.${userId}`
          },
          () => {
            fetchRecentActivity();
          }
        )
        .subscribe(),

      supabase
        .channel('profiles-activity')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`
          },
          () => {
            fetchRecentActivity();
          }
        )
        .subscribe()
    ];

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [userId, refreshTrigger]);

  const getActivityIcon = (icon: string, color: string) => {
    const colorClasses = {
      green: 'bg-green-500/20 text-green-600',
      yellow: 'bg-yellow-500/20 text-yellow-600',
      red: 'bg-red-500/20 text-red-600',
      orange: 'bg-orange-500/20 text-orange-600',
      purple: 'bg-purple-500/20 text-purple-600',
      blue: 'bg-blue-500/20 text-blue-600',
      gray: 'bg-gray-500/20 text-gray-600'
    };

    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorClasses[color as keyof typeof colorClasses] || colorClasses.gray}`}>
        <span className="text-sm font-medium">{icon}</span>
      </div>
    );
  };

  const getActivityTypeBadge = (type: ActivityType) => {
    const badges = {
      completion: { label: 'Habit', variant: 'default' as const },
      streak: { label: 'Streak', variant: 'secondary' as const },
      milestone: { label: 'Milestone', variant: 'outline' as const },
      created: { label: 'New', variant: 'outline' as const }
    };

    const config = badges[type];
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const activityDate = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) { // Less than 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else if (diffInMinutes < 2880) { // Less than 48 hours
      return 'Yesterday';
    } else {
      return format(activityDate, 'MMM d');
    }
  };

  // Filter activities by type for stats
  const getActivityStats = () => {
    const today = new Date().toDateString();
    
    return {
      completedToday: activities.filter(a => {
        if (a.type !== 'completion') return false;
        const activityDate = new Date(a.timestamp);
        return activityDate.toDateString() === today && a.icon === '✓';
      }).length,
      completedCount: activities.filter(a => a.type === 'completion' && a.icon === '✓').length,
      skippedCount: activities.filter(a => a.type === 'completion' && a.icon === '⭕').length,
      milestonesCount: activities.filter(a => a.type === 'milestone').length,
      newHabitsCount: activities.filter(a => a.type === 'created').length
    };
  };

  const stats = getActivityStats();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-4 h-4" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Your latest habit completions and achievements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Activity className="w-12 h-12 mx-auto mb-3 text-destructive opacity-50" />
            <p className="text-destructive mb-2">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchRecentActivity}
              className="mt-2"
            >
              <Loader2 className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-4 h-4" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Your latest habit completions and achievements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                No recent activity yet
              </p>
              <p className="text-xs text-muted-foreground">
                Complete some habits or create new ones to see activity here!
              </p>
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-xs">✓</div>
                <span>Complete habits</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-600 text-xs">🔥</div>
                <span>Build streaks</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 text-xs">➕</div>
                <span>Create habits</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40">
          {activities.map((activity) => (
            <div 
              key={activity.id} 
              className="flex items-start gap-3 group hover:bg-muted/30 p-2 rounded-lg transition-colors"
            >
              <div className="flex-shrink-0 mt-1">
                {getActivityIcon(activity.icon, activity.color)}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {activity.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getActivityTypeBadge(activity.type)}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {activity.description}
                </p>
                {activity.streak && (
                  <div className="flex items-center gap-1 pt-1">
                    <Flame className="w-3 h-3 text-warning" />
                    <span className="text-xs font-medium">{activity.streak} day streak</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Activity Stats */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-lg font-bold">{stats.completedToday}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-lg font-bold">{stats.completedCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Milestones</p>
              <p className="text-lg font-bold">{stats.milestonesCount}</p>
            </div>
          </div>
        </div>

        {/* Activity Legend */}
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">LEGEND</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500/20 flex items-center justify-center text-green-600 text-xs">✓</div>
              <span className="text-muted-foreground">Done</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-600 text-xs">⭕</div>
              <span className="text-muted-foreground">Skipped</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500/20 flex items-center justify-center text-red-600 text-xs">✗</div>
              <span className="text-muted-foreground">Missed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-600 text-xs">🔥</div>
              <span className="text-muted-foreground">Milestone</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 text-xs">➕</div>
              <span className="text-muted-foreground">New</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};