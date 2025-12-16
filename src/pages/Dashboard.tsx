import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Flame, LogOut, Plus, Trophy, BarChart3, Calendar, List, 
  Target, Menu, Medal, Crown, Award, CheckCircle, Clock, 
  TrendingUp, Zap, Activity, TargetIcon, TrendingDown, Circle,
  ChevronDown, ChevronUp, CheckSquare, XCircle, TrendingUpIcon
} from "lucide-react";
import { toast } from "sonner";
import { HabitList } from "@/components/HabitList";
import { StatsOverview } from "@/components/StatsOverview";
import { Leaderboard } from "@/components/Leaderboard";
import { CreateHabitDialog } from "@/components/CreateHabitDialog";
import { WeeklyStreakChart } from "@/components/WeeklyStreakChart";
import { WeeklyStreakTable } from "@/components/WeeklyStreakTable";
import { ProfileIcon } from "@/components/ProfileIcon";
import { RecentActivity } from "@/components/RecentActivity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingHabit, setEditingHabit] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  
  // Real data states
  const [dailyStats, setDailyStats] = useState({
    completed: 0,
    pending: 0,
    total: 0,
    streak: 0,
    completionRate: 0,
    totalStreak: 0,
    bestStreak: 0,
    weeklyAverage: 0
  });
  const [habits, setHabits] = useState<any[]>([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [weeklyInsights, setWeeklyInsights] = useState({
    mostProductiveDay: "",
    averageCompletion: 0
  });
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Responsive breakpoints
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1024px)");
  const isDesktop = useMediaQuery("(min-width: 1025px)");
  const isLargeDesktop = useMediaQuery("(min-width: 1536px)");

  // Orientation detection
  const [isPortrait, setIsPortrait] = useState(
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : true
  );

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      
      // Fetch user's data
      await Promise.all([
        fetchDailyStats(session.user.id),
        fetchUserHabits(session.user.id),
        fetchUserStreakData(session.user.id)
      ]);
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      } else if (session) {
        setUser(session.user);
        fetchDailyStats(session.user.id);
        fetchUserHabits(session.user.id);
        fetchUserStreakData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;
    let pollInterval: NodeJS.Timeout;

    const fetchLeaderboard = async () => {
      if (!mounted) return;

      setLeaderboardLoading(true);
      setLeaderboardError(null);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .gt('total_streak', 0)
          .order('total_streak', { ascending: false })
          .limit(10);

        if (error) {
          console.error("Leaderboard fetch error:", error);
          setLeaderboardError("Failed to load leaderboard");
          toast.error("Could not load leaderboard data");
          return;
        }

        if (mounted) {
          setLeaderboardData(data || []);
          
          if (data) {
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('total_streak')
              .eq('id', user.id)
              .single();

            if (userProfile && userProfile.total_streak > 0) {
              const userIndex = data.findIndex(p => p.id === user.id);
              if (userIndex !== -1) {
                setUserRank(userIndex + 1);
              } else {
                const { data: allProfiles } = await supabase
                  .from('profiles')
                  .select('id, total_streak')
                  .gt('total_streak', 0)
                  .order('total_streak', { ascending: false });

                if (allProfiles) {
                  const actualIndex = allProfiles.findIndex(p => p.id === user.id);
                  setUserRank(actualIndex >= 0 ? actualIndex + 1 : null);
                }
              }
            } else {
              setUserRank(null);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        setLeaderboardError("An unexpected error occurred");
      } finally {
        if (mounted) {
          setLeaderboardLoading(false);
        }
      }
    };

    fetchLeaderboard();

    pollInterval = setInterval(fetchLeaderboard, 30000);

    const channel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          if (mounted) {
            if (payload.new.id === user.id) {
              fetchLeaderboard();
            } else {
              setLeaderboardData(prev => {
                const updatedData = [...prev];
                const index = updatedData.findIndex(u => u.id === payload.new.id);
                
                if (index !== -1) {
                  updatedData[index] = { ...updatedData[index], ...payload.new };
                }
                
                return updatedData.sort((a, b) => b.total_streak - a.total_streak);
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshTrigger]);

  const fetchDailyStats = async (userId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch today's habit logs (completions)
      const { data: habitLogs, error: logsError } = await supabase
        .from('habit_logs')
        .select(`
          habit_id,
          status,
          log_date
        `)
        .eq('log_date', today)
        .in('status', ['done', 'skipped', 'missed', 'pending']);

      if (logsError) {
        console.error("Error fetching habit logs:", logsError);
        return;
      }

      // Fetch user's active habits
      const { data: userHabits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        // Assuming you have an is_active field or all habits are active
        // If not, remove the .eq('is_active', true) line
        .order('created_at', { ascending: false });

      if (habitsError) {
        console.error("Error fetching habits:", habitsError);
        return;
      }

      const totalHabits = userHabits?.length || 0;
      const completedToday = habitLogs?.filter(log => log.status === 'done').length || 0;
      const pendingToday = Math.max(0, totalHabits - completedToday);
      const completionRate = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

      setDailyStats(prev => ({
        ...prev,
        completed: completedToday,
        pending: pendingToday,
        total: totalHabits,
        completionRate: completionRate
      }));
    } catch (error) {
      console.error("Error fetching daily stats:", error);
    }
  };

  const fetchUserHabits = async (userId: string) => {
    try {
      setHabitsLoading(true);
      const { data, error } = await supabase
        .from('habits')
        .select(`
          *,
          categories (
            name
          )
        `)
        .eq('user_id', userId)
        // Remove if you don't have is_active field
        // .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching habits:", error);
        toast.error("Could not load habits");
        return;
      }

      setHabits(data || []);
    } catch (error) {
      console.error("Error fetching habits:", error);
    } finally {
      setHabitsLoading(false);
    }
  };

  const fetchUserStreakData = async (userId: string) => {
    try {
      // Fetch user's current streak from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('total_streak')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error("Error fetching profile streak:", profileError);
        return;
      }

      // Calculate best streak from habits
      const { data: userHabits, error: habitsError } = await supabase
        .from('habits')
        .select('current_streak')
        .eq('user_id', userId);

      if (habitsError) {
        console.error("Error fetching habits for streak:", habitsError);
        return;
      }

      // Calculate best streak from all habits
      const bestStreak = userHabits?.reduce((max, habit) => 
        Math.max(max, habit.current_streak || 0), 0) || 0;

      // Fetch weekly habit logs for insights
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);
      
      const { data: weeklyLogs, error: weeklyError } = await supabase
        .from('habit_logs')
        .select(`
          log_date,
          status,
          habits!inner (
            user_id
          )
        `)
        .eq('habits.user_id', userId)
        .gte('log_date', last7Days.toISOString().split('T')[0])
        .in('status', ['done', 'skipped', 'missed', 'pending']);

      if (weeklyError) {
        console.error("Error fetching weekly logs:", weeklyError);
        return;
      }

      // Calculate weekly insights
      const dayCounts: Record<string, number> = {};
      let totalCompletions = 0;
      
      weeklyLogs?.forEach(log => {
        if (log.status === 'done') {
          const date = new Date(log.log_date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
          dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
          totalCompletions++;
        }
      });

      let mostProductiveDay = "";
      let maxCount = 0;
      
      Object.entries(dayCounts).forEach(([day, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostProductiveDay = day;
        }
      });

      const weeklyAverage = habits.length > 0 
        ? Math.round((totalCompletions / (habits.length * 7)) * 100)
        : 0;

      setWeeklyInsights({
        mostProductiveDay: mostProductiveDay || "No data",
        averageCompletion: weeklyAverage
      });

      setDailyStats(prev => ({
        ...prev,
        streak: profile?.total_streak || 0,
        totalStreak: profile?.total_streak || 0,
        bestStreak: bestStreak
      }));
    } catch (error) {
      console.error("Error fetching streak data:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    setShowSignOutDialog(false);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    if (user?.id) {
      fetchDailyStats(user.id);
      fetchUserHabits(user.id);
      fetchUserStreakData(user.id);
    }
  };

  const handleEditHabit = (habit: any) => {
    setEditingHabit(habit);
    setShowCreateDialog(true);
  };

  const handleDialogClose = () => {
    setShowCreateDialog(false);
    setTimeout(() => setEditingHabit(null), 200);
  };

  // Responsive grid columns for daily stats - Fixed width cards
  const getStatsGridCols = () => {
    if (isMobile) {
      return "grid-cols-3";
    }
    if (isTablet) {
      return "grid-cols-3";
    }
    return "grid-cols-3";
  };

  // Responsive container padding - Fixed width
  const getContainerPadding = () => {
    if (isMobile) {
      return "px-3 py-3";
    }
    if (isTablet) {
      return "px-4 py-5";
    }
    return "px-4 py-6";
  };

  // Card width classes - Fixed width for all screens
  const getCardWidth = () => {
    return "w-full";
  };

  // Card internal padding - Responsive but maintains fixed width
  const getCardPadding = () => {
    if (isMobile) {
      return "p-3";
    }
    if (isTablet) {
      return "p-4";
    }
    return "p-5";
  };

  // Card header padding - Responsive
  const getCardHeaderPadding = () => {
    if (isMobile) {
      return "px-3 pt-3 pb-2";
    }
    if (isTablet) {
      return "px-4 pt-4 pb-3";
    }
    return "px-5 pt-5 pb-4";
  };

  // Card content padding - Responsive
  const getCardContentPadding = () => {
    if (isMobile) {
      return "px-3 pt-2 pb-3";
    }
    if (isTablet) {
      return "px-4 pt-3 pb-4";
    }
    return "px-5 pt-4 pb-5";
  };

  // Text size for card titles based on screen size
  const getCardTitleSize = () => {
    if (isMobile) {
      return "text-sm";
    }
    return "text-base";
  };

  // Text size for card descriptions
  const getCardDescriptionSize = () => {
    if (isMobile) {
      return "text-xs";
    }
    return "text-sm";
  };

  // Text truncation utility
  const getTruncateClass = () => {
    return "truncate";
  };

  // Top 3 Podium Component with mobile sizing - Fixed width
  const TopThreePodium = () => {
    if (leaderboardLoading) {
      return (
        <div className="animate-pulse w-full">
          <div className={cn(
            "flex items-end justify-center gap-2 py-4 w-full",
            isMobile && !isPortrait && "gap-1 py-3"
          )}>
            {[2, 1, 3].map((i) => (
              <div key={i} className="flex flex-col items-center flex-1 max-w-[33.333%]">
                <div className={cn(
                  "rounded-full bg-muted mb-2",
                  i === 1 ? "w-10 h-10" : "w-8 h-8",
                  isMobile && !isPortrait && i === 1 ? "w-8 h-8" : "w-6 h-6"
                )} />
                <div className={cn(
                  "bg-muted rounded-xl mb-1.5 w-full",
                  i === 1 ? "h-6" : "h-5",
                  isMobile && !isPortrait && i === 1 ? "h-5" : "h-4"
                )} />
                <div className={cn(
                  "bg-muted rounded w-full",
                  isMobile ? "h-2" : "h-3",
                  isMobile && !isPortrait && "h-2"
                )} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (leaderboardError) {
      return (
        <div className={cn(
          "py-4 text-center w-full",
          isMobile && "py-3"
        )}>
          <p className="text-destructive mb-2 text-xs sm:text-sm w-full">Failed to load leaderboard</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="mt-1 text-xs h-7"
          >
            Retry
          </Button>
        </div>
      );
    }

    const top3 = leaderboardData.slice(0, 3);
    
    if (top3.length === 0) {
      return (
        <div className={cn(
          "py-4 text-center w-full",
          isMobile && "py-3"
        )}>
          <Trophy className={cn(
            "mx-auto mb-3 text-muted-foreground opacity-50",
            isMobile ? "w-8 h-8" : "w-10 h-10"
          )} />
          <p className="text-muted-foreground text-xs sm:text-sm w-full">No leaderboard data</p>
          <p className="text-xs text-muted-foreground mt-1 w-full">
            Start completing habits to appear!
          </p>
        </div>
      );
    }

    const getRankIcon = (rank: number) => {
      const baseClass = "flex items-center justify-center rounded-full";
      const size = isMobile 
        ? isPortrait ? "w-8 h-8" : "w-6 h-6" 
        : "w-12 h-12";
      
      switch (rank) {
        case 1:
          return (
            <div className={`${baseClass} ${size} bg-gradient-to-br from-yellow-300 to-yellow-500 shadow`}>
              <Crown className={cn(
                "text-white",
                isMobile ? "w-4 h-4" : "w-5 h-5"
              )} />
            </div>
          );
        case 2:
          return (
            <div className={`${baseClass} ${size} bg-gradient-to-br from-gray-300 to-gray-400`}>
              <Medal className={cn(
                "text-white",
                isMobile ? "w-3 h-3" : "w-4 h-4"
              )} />
            </div>
          );
        case 3:
          return (
            <div className={`${baseClass} ${size} bg-gradient-to-br from-orange-300 to-orange-500`}>
              <Award className={cn(
                "text-white",
                isMobile ? "w-3 h-3" : "w-4 h-4"
              )} />
            </div>
          );
        default:
          return null;
      }
    };

    // Order for podium display: 2nd (left), 1st (middle), 3rd (right)
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

    return (
      <div className="space-y-3 sm:space-y-4 w-full">
        <div className={cn(
          "flex items-end justify-center gap-2 w-full",
          isMobile && !isPortrait ? "gap-1" : "md:gap-4"
        )}>
          {podiumOrder.map((leader, index) => {
            const actualIndex = leader === top3[0] ? 0 : leader === top3[1] ? 1 : 2;
            const height = isMobile
              ? isPortrait 
                ? actualIndex === 0 ? "h-16" : "h-14"
                : actualIndex === 0 ? "h-14" : "h-12"
              : actualIndex === 0 ? "h-20" : "h-16";
            
            return (
              <div 
                key={leader.id}
                className={cn(
                  "flex flex-col items-center flex-1 max-w-[33.333%]",
                  actualIndex === 0 ? "order-2" : actualIndex === 1 ? "order-1" : "order-3"
                )}
              >
                <div className={cn(
                  "w-full rounded-t-lg mb-2 flex items-center justify-center",
                  height,
                  actualIndex === 0 
                    ? "bg-gradient-to-b from-yellow-500/30 to-yellow-500/10" 
                    : actualIndex === 1
                    ? "bg-gradient-to-b from-gray-500/30 to-gray-500/10"
                    : "bg-gradient-to-b from-orange-500/30 to-orange-500/10"
                )}>
                  <div className="-mt-4">
                    {getRankIcon(actualIndex + 1)}
                  </div>
                </div>
                
                <div className="text-center min-w-0 w-full px-1">
                  <h3 className={cn(
                    "font-semibold truncate",
                    isMobile ? "text-xs" : "text-sm",
                    isMobile && !isPortrait && "text-xs"
                  )}>
                    {leader.username || leader.email?.split('@')[0] || 'User'}
                  </h3>
                  {leader.id === user?.id && (
                    <Badge variant="secondary" size="sm" className={cn(
                      "mt-0.5 bg-primary/20 text-primary text-[10px] px-1 h-4 w-full",
                      isMobile && !isPortrait && "text-[9px] h-3"
                    )}>
                      You
                    </Badge>
                  )}
                  <div className="flex items-center justify-center gap-0.5 mt-1">
                    <Flame className={cn(
                      "text-orange-500",
                      isMobile ? "w-2.5 h-2.5" : "w-3 h-3"
                    )} />
                    <span className={cn(
                      "font-bold",
                      isMobile ? "text-sm" : "text-base"
                    )}>{leader.total_streak || 0}</span>
                  </div>
                  <Badge variant="outline" className={cn(
                    "mt-0.5 text-[10px] h-4 w-full",
                    isMobile ? "text-xs" : "text-sm",
                    isMobile && !isPortrait && "text-[9px] h-3"
                  )}>
                    #{actualIndex + 1}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // User Stats Component with mobile sizing - Fixed width
  const UserStats = () => {
    const currentUser = leaderboardData.find(u => u.id === user?.id);
    const userStreak = currentUser?.total_streak || dailyStats.streak;
    
    return (
      <div className={cn(
        "mt-3 sm:mt-4 p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20 w-full",
        isMobile && !isPortrait && "p-2"
      )}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className={cn(
              "rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0",
              isMobile ? "w-8 h-8" : "w-10 h-10"
            )}>
              <Trophy className={cn(
                "text-white",
                isMobile ? "w-4 h-4" : "w-5 h-5"
              )} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn(
                "text-muted-foreground truncate text-xs",
                isMobile ? "text-xs" : "text-sm"
              )}>Your Rank</p>
              <p className={cn(
                "font-bold truncate",
                isMobile ? "text-lg" : "text-xl"
              )}>
                {userRank ? `#${userRank}` : userStreak > 0 ? 'Ranking...' : 'Unranked'}
              </p>
            </div>
          </div>
          <div className="text-right min-w-0 flex-1">
            <p className={cn(
              "text-muted-foreground truncate text-xs",
              isMobile ? "text-xs" : "text-sm"
            )}>Current Streak</p>
            <div className="flex items-center gap-1 justify-end">
              <Flame className={cn(
                "text-orange-500 flex-shrink-0",
                isMobile ? "w-3 h-3" : "w-4 h-4"
              )} />
              <p className={cn(
                "font-bold text-primary truncate",
                isMobile ? "text-lg" : "text-xl"
              )}>
                {userStreak || 0}
              </p>
            </div>
          </div>
        </div>
        
        {userStreak === 0 && (
          <div className="mt-2 pt-2 border-t border-primary/20 w-full">
            <p className="text-xs text-muted-foreground text-center w-full">
              Complete habits to appear on the leaderboard!
            </p>
          </div>
        )}
      </div>
    );
  };

  // Daily Stats Component - Fixed width on mobile
  const DailyStatsCard = () => (
    <div className={cn(
      "grid gap-2 mb-4 w-full",
      getStatsGridCols()
    )}>
      <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg p-2 border border-green-500/20 w-full">
        <div className="flex items-center justify-between w-full">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-green-600 truncate">Completed</p>
            <p className="text-lg font-bold truncate">{dailyStats.completed}</p>
          </div>
          <div className="p-1.5 bg-green-500/20 rounded-lg flex-shrink-0 ml-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 truncate w-full">Of {dailyStats.total} total</p>
      </div>

      <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-2 border border-blue-500/20 w-full">
        <div className="flex items-center justify-between w-full">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-blue-600 truncate">Pending</p>
            <p className="text-lg font-bold truncate">{dailyStats.pending}</p>
          </div>
          <div className="p-1.5 bg-blue-500/20 rounded-lg flex-shrink-0 ml-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 truncate w-full">Remaining today</p>
      </div>

      <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg p-2 border border-purple-500/20 w-full">
        <div className="flex items-center justify-between w-full">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-purple-600 truncate">Streak</p>
            <p className="text-lg font-bold truncate">{dailyStats.streak}</p>
          </div>
          <div className="p-1.5 bg-purple-500/20 rounded-lg flex-shrink-0 ml-1">
            <Flame className="w-3.5 h-3.5 text-purple-500" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 truncate w-full">Consecutive days</p>
      </div>
    </div>
  );

  // Loading Skeletons - Responsive with fixed width
  const LoadingSkeleton = () => (
    <div className="animate-pulse w-full">
      {/* Header Loading */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50 w-full">
        <div className={cn(
          "container mx-auto",
          isMobile ? "px-3 py-3" : "px-4 py-4"
        )}>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 sm:gap-3 w-full">
              <div className={cn(
                "bg-muted rounded-md flex-shrink-0",
                isMobile ? "w-8 h-8" : "w-10 h-10"
              )}></div>
              <div className="hidden sm:block w-full">
                <div className="h-6 bg-muted rounded w-32 mb-1"></div>
                <div className="h-3 bg-muted rounded w-24"></div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className={cn(
                "h-8 bg-muted rounded",
                isMobile ? "w-12" : "w-16"
              )}></div>
            </div>
          </div>
        </div>
      </div>

      <main className={cn(
        "container mx-auto w-full",
        getContainerPadding()
      )}>
        {/* Quick Actions Header Loading */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 w-full">
          <div className="space-y-2 min-w-0 w-full">
            <div className={cn(
              "h-8 bg-muted rounded",
              isMobile ? "w-32" : "w-40"
            )}></div>
            <div className={cn(
              "h-4 bg-muted rounded",
              isMobile ? "w-48" : "w-64"
            )}></div>
          </div>
          <div className={cn(
            "h-10 bg-muted rounded",
            isMobile ? "w-full" : "w-32"
          )}></div>
        </div>

        {/* Daily Stats Loading */}
        <div className={cn(
          "grid gap-2 mb-4 w-full",
          getStatsGridCols()
        )}>
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-muted/30 rounded-lg p-2 w-full">
              <div className="flex items-center justify-between w-full">
                <div className="min-w-0 flex-1">
                  <div className={cn(
                    "h-3 bg-muted rounded mb-1.5",
                    isMobile ? "w-10" : "w-12"
                  )}></div>
                  <div className={cn(
                    "h-5 bg-muted rounded",
                    isMobile ? "w-5" : "w-6"
                  )}></div>
                </div>
                <div className={cn(
                  "bg-muted rounded-lg flex-shrink-0 ml-1",
                  isMobile ? "w-6 h-6" : "w-7 h-7"
                )}></div>
              </div>
              <div className={cn(
                "h-2.5 bg-muted rounded mt-1 w-full",
                isMobile ? "w-full" : "w-full"
              )}></div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2 w-full">
          {/* Left Column Loading */}
          <div className="space-y-4 w-full">
            <div className="bg-card rounded-lg p-3 w-full">
              <div className="space-y-2 w-full">
                <div className="flex items-center gap-2 w-full">
                  <div className="w-4 h-4 bg-muted rounded flex-shrink-0"></div>
                  <div className={cn(
                    "h-4 bg-muted rounded w-full",
                    isMobile ? "w-full" : "w-full"
                  )}></div>
                </div>
                <div className={cn(
                  "h-3 bg-muted rounded w-full",
                    isMobile ? "w-full" : "w-full"
                )}></div>
                <div className="h-32 bg-muted/30 rounded-lg mt-3 w-full"></div>
              </div>
            </div>
          </div>

          {/* Right Column Loading */}
          <div className="space-y-4 w-full">
            <div className="bg-card rounded-lg p-3 w-full">
              <div className="space-y-2 w-full">
                <div className="flex items-center gap-2 w-full">
                  <div className="w-4 h-4 bg-muted rounded flex-shrink-0"></div>
                  <div className={cn(
                    "h-4 bg-muted rounded w-full",
                    isMobile ? "w-full" : "w-full"
                  )}></div>
                </div>
                <div className={cn(
                  "h-3 bg-muted rounded w-full",
                  isMobile ? "w-full" : "w-full"
                )}></div>
                <div className="flex items-end justify-center gap-2 py-4 w-full">
                  {[2, 1, 3].map((i) => (
                    <div key={i} className="flex flex-col items-center flex-1 max-w-[33.333%]">
                      <div className={cn(
                        "rounded-full bg-muted mb-2 w-full",
                        i === 1 ? "h-10" : "h-8"
                      )} />
                      <div className={cn(
                        "bg-muted rounded-xl mb-1.5 w-full",
                        i === 1 ? "h-6" : "h-5"
                      )} />
                      <div className="bg-muted rounded w-full h-2.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background w-full">
        <LoadingSkeleton />
      </div>
    );
  }

  // Mobile Navigation Sheet
  const MobileNavigation = () => (
    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="left" 
        className={cn(
          "w-[280px] sm:w-[350px]",
          isMobile && !isPortrait && "w-[320px]"
        )}
      >
        <div className="flex flex-col h-full w-full">
          <div className="flex items-center gap-3 mb-6 sm:mb-8 w-full">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex-shrink-0">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-br from-primary to-primary/80 bg-clip-text text-transparent truncate">
                StreakMaster
              </h1>
              <p className="text-xs text-muted-foreground truncate">Completion Habits Tracking</p>
            </div>
          </div>
          
          <div className="flex-1 space-y-2 sm:space-y-4 w-full">
            <Button
              variant={activeTab === "overview" ? "secondary" : "ghost"}
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                setActiveTab("overview");
                setIsMobileMenuOpen(false);
              }}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <Button
              variant={activeTab === "habits" ? "secondary" : "ghost"}
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                setActiveTab("habits");
                setIsMobileMenuOpen(false);
              }}
            >
              <List className="w-4 h-4 mr-2" />
              My Habits
            </Button>
            <Button
              variant={activeTab === "analytics" ? "secondary" : "ghost"}
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                setActiveTab("analytics");
                setIsMobileMenuOpen(false);
              }}
            >
              <Target className="w-4 h-4 mr-2" />
              Analytics
            </Button>
            <Button
              variant={activeTab === "leaderboard" ? "secondary" : "ghost"}
              className="w-full justify-start text-sm sm:text-base"
              onClick={() => {
                setActiveTab("leaderboard");
                setIsMobileMenuOpen(false);
              }}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
          </div>
          
          <div className="pt-4 sm:pt-6 border-t w-full">
            <Button 
              variant="destructive" 
              className="w-full text-sm sm:text-base"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setShowSignOutDialog(true);
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Collapsible Header for mobile landscape
  const CollapsibleHeader = () => {
    if (!isMobile || isPortrait) return null;

    return (
      <div className="flex items-center justify-center mb-2 w-full">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs h-6 px-2"
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              Show Header
            </>
          ) : (
            <>
              <ChevronUp className="w-3 h-3 mr-1" />
              Hide Header
            </>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 w-full">
      <header className={cn(
        "border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 transition-all duration-300 w-full",
        isMobile && !isPortrait && isCollapsed ? "h-0 border-0 overflow-hidden" : "py-2 sm:py-4"
      )}>
        <div className="container mx-auto px-3 sm:px-4 w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 sm:gap-3">
              <MobileNavigation />
              <div className={cn(
                "bg-gradient-to-br from-primary to-primary/80 rounded-lg flex-shrink-0",
                isMobile ? "p-1" : "hidden sm:flex p-2"
              )}>
                <Flame className={cn(
                  "text-white",
                  isMobile ? "w-4 h-4" : "w-6 h-6"
                )} />
              </div>
              <div className="hidden sm:block min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-br from-primary to-primary/80 bg-clip-text text-transparent truncate">
                  StreakMaster
                </h1>
                <p className="text-xs text-muted-foreground truncate">Completion Habits Tracking</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <ProfileIcon 
                user={user} 
                onSignOut={() => setShowSignOutDialog(true)} 
                size={isMobile ? "sm" : "default"}
              />
            </div>
          </div>
        </div>
      </header>

      <CollapsibleHeader />

      <main className={cn(
        "container mx-auto w-full",
        getContainerPadding()
      )}>
        {/* Dashboard Header */}
        <div className={cn(
          "flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-4 w-full",
          isMobile && !isPortrait && "flex-row items-center mb-3"
        )}>
          <div className={cn(
            "min-w-0 w-full",
            isMobile && !isPortrait && "flex-1"
          )}>
            <h1 className={cn(
              "font-bold tracking-tight truncate w-full",
              isMobile && !isPortrait ? "text-lg" : "text-xl sm:text-2xl"
            )}>Dashboard</h1>
            <p className={cn(
              "text-muted-foreground truncate w-full",
              isMobile && !isPortrait ? "text-xs" : "text-sm"
            )}>
              Track your progress and build better habits
            </p>
          </div>
          <Button 
            onClick={() => {
              setEditingHabit(null);
              setShowCreateDialog(true);
            }}
            className={cn(
              "bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70",
              isMobile ? "w-full sm:w-auto" : "w-full lg:w-auto",
              isMobile && !isPortrait ? "text-xs h-8" : "text-sm h-9 sm:h-10"
            )}
            size={isMobile && !isPortrait ? "sm" : "lg"}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
            <span>New Habit</span>
          </Button>
        </div>

        {/* Daily Stats */}
        <DailyStatsCard />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 w-full">
          {/* Desktop Tabs */}
          <TabsList className={cn(
            "hidden sm:grid gap-2 p-1 bg-muted/50 rounded-lg w-full",
            isTablet ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
          )}>
            <TabsTrigger value="overview" className="flex items-center gap-2 w-full">
              <BarChart3 className="w-4 h-4" />
              <span className={cn(isTablet && "hidden lg:inline")}>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="habits" className="flex items-center gap-2 w-full">
              <List className="w-4 h-4" />
              <span className={cn(isTablet && "hidden lg:inline")}>My Habits</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 w-full">
              <Target className="w-4 h-4" />
              <span className={cn(isTablet && "hidden lg:inline")}>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2 w-full">
              <Trophy className="w-4 h-4" />
              <span className={cn(isTablet && "hidden lg:inline")}>Leaderboard</span>
            </TabsTrigger>
          </TabsList>

          {/* Mobile Tab Switcher */}
          <div className="sm:hidden w-full">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-9 text-sm">
                  <div className="flex items-center gap-2 w-full">
                    {activeTab === "overview" && <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />}
                    {activeTab === "habits" && <List className="w-3.5 h-3.5 flex-shrink-0" />}
                    {activeTab === "analytics" && <Target className="w-3.5 h-3.5 flex-shrink-0" />}
                    {activeTab === "leaderboard" && <Trophy className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span className="capitalize text-sm truncate flex-1 text-left">
                      {activeTab === "overview" && "Overview"}
                      {activeTab === "habits" && "My Habits"}
                      {activeTab === "analytics" && "Analytics"}
                      {activeTab === "leaderboard" && "Leaderboard"}
                    </span>
                  </div>
                  <Menu className="w-3.5 h-3.5 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[calc(100vw-2rem)]">
                <DropdownMenuItem onClick={() => setActiveTab("overview")} className="text-sm w-full">
                  <BarChart3 className="w-3.5 h-3.5 mr-2" />
                  Overview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("habits")} className="text-sm w-full">
                  <List className="w-3.5 h-3.5 mr-2" />
                  My Habits
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("analytics")} className="text-sm w-full">
                  <Target className="w-3.5 h-3.5 mr-2" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("leaderboard")} className="text-sm w-full">
                  <Trophy className="w-3.5 h-3.5 mr-2" />
                  Leaderboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Overview Tab - Now with real data */}
          <TabsContent value="overview" className="space-y-4 w-full">
            <div className={cn(
              "grid gap-4 w-full",
              isMobile && !isPortrait ? "grid-cols-1" : "lg:grid-cols-2"
            )}>
              {/* Left Column - Progress & Analytics */}
              <div className="space-y-4 w-full">
                <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
                  <CardHeader className={cn("pb-2 w-full", getCardHeaderPadding())}>
                    <CardTitle className={cn(
                      "flex items-center gap-1.5 w-full",
                      getCardTitleSize()
                    )}>
                      <BarChart3 className={cn(
                        isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                      )} />
                      <span className={getTruncateClass()}>Today's Progress</span>
                    </CardTitle>
                    <CardDescription className={cn(
                      getCardDescriptionSize(),
                      getTruncateClass(),
                      "w-full"
                    )}>
                      Your completion rate for today
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={cn("w-full", getCardContentPadding())}>
                    <div className="space-y-4 w-full">
                      <div className="w-full">
                        <div className="flex items-center justify-between mb-2 w-full">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium truncate">Daily Completion</span>
                            <p className="text-xs text-muted-foreground truncate">
                              {dailyStats.completed} of {dailyStats.total} habits completed
                            </p>
                          </div>
                          <span className={cn(
                            "font-bold flex-shrink-0 ml-2 truncate",
                            isMobile ? "text-lg" : "text-xl"
                          )}>{dailyStats.completionRate}%</span>
                        </div>
                        <Progress value={dailyStats.completionRate} className="h-2 w-full" />
                      </div>
                      
                      <Separator className="my-2 w-full" />

                      <div className="grid grid-cols-2 gap-3 w-full">
                        <div className="bg-muted/20 rounded-lg p-3 w-full">
                          <div className="flex items-center gap-1.5 mb-1.5 w-full">
                            <Activity className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <span className="text-xs font-medium truncate">Active Habits</span>
                          </div>
                          <p className="text-xl font-bold truncate w-full">{dailyStats.total}</p>
                        </div>
                        <div className="bg-muted/20 rounded-lg p-3 w-full">
                          <div className="flex items-center gap-1.5 mb-1.5 w-full">
                            <TrendingUpIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <span className="text-xs font-medium truncate">Best Streak</span>
                          </div>
                          <p className="text-xl font-bold truncate w-full">{dailyStats.bestStreak} days</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
                  <CardHeader className={cn("pb-2 w-full", getCardHeaderPadding())}>
                    <CardTitle className={cn(
                      "flex items-center gap-1.5 w-full",
                      getCardTitleSize()
                    )}>
                      <Calendar className={cn(
                        isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                      )} />
                      <span className={getTruncateClass()}>Weekly Progress</span>
                    </CardTitle>
                    <CardDescription className={cn(
                      getCardDescriptionSize(),
                      getTruncateClass(),
                      "w-full"
                    )}>
                      Your streak performance this week
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={cn("w-full", getCardContentPadding())}>
                    <div className="space-y-4 w-full">
                      <div className="w-full">
                        <p className="text-sm font-medium mb-2 truncate w-full">Daily habit completion rate</p>
                        <WeeklyStreakChart 
                          userId={user?.id} 
                          refreshTrigger={refreshTrigger}
                          compact={isMobile}
                        />
                      </div>
                      
                      <div className="text-xs text-muted-foreground w-full">
                        <p className="font-medium mb-1.5 truncate w-full">Weekly Insights</p>
                        <ul className="space-y-1 w-full">
                          <li className="flex items-center gap-1.5 w-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></div>
                            <span className="truncate">Most productive day: {weeklyInsights.mostProductiveDay || "No data yet"}</span>
                          </li>
                          <li className="flex items-center gap-1.5 w-full">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 flex-shrink-0"></div>
                            <span className="truncate">Average daily completion: {weeklyInsights.averageCompletion}%</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Leaderboard & Activity */}
              <div className="space-y-4 w-full">
                <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
                  <CardHeader className={cn("pb-2 w-full", getCardHeaderPadding())}>
                    <CardTitle className={cn(
                      "flex items-center gap-1.5 w-full",
                      getCardTitleSize()
                    )}>
                      <Trophy className={cn(
                        isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                      )} />
                      <span className={getTruncateClass()}>Top Performers</span>
                    </CardTitle>
                    <CardDescription className={cn(
                      getCardDescriptionSize(),
                      getTruncateClass(),
                      "w-full"
                    )}>
                      Leaderboard podium
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={cn("w-full", getCardContentPadding())}>
                    <TopThreePodium />
                    <UserStats />
                  </CardContent>
                </Card>

                <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
                  <CardHeader className={cn("pb-2 w-full", getCardHeaderPadding())}>
                    <CardTitle className={cn(
                      "flex items-center gap-1.5 w-full",
                      getCardTitleSize()
                    )}>
                      <Activity className={cn(
                        isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                      )} />
                      <span className={getTruncateClass()}>Recent Activity</span>
                    </CardTitle>
                    <CardDescription className={cn(
                      getCardDescriptionSize(),
                      getTruncateClass(),
                      "w-full"
                    )}>
                      Your latest habit completions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={cn("w-full", getCardContentPadding())}>
                    <RecentActivity 
                      userId={user?.id} 
                      refreshTrigger={refreshTrigger}
                      compact={isMobile}
                    />
                    
                    <div className="mt-3 pt-3 border-t w-full">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs h-7 truncate"
                        onClick={() => setActiveTab("habits")}
                      >
                        View All Habits ({habits.length})
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Other Tabs with real data */}
          <TabsContent value="habits" className="space-y-4 w-full">
            <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
              <CardHeader className={cn("w-full", getCardHeaderPadding())}>
                <CardTitle className={cn(
                  "flex items-center gap-1.5 w-full",
                  getCardTitleSize()
                )}>
                  <List className={cn(
                    isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                  )} />
                  <span className={getTruncateClass()}>Your Habits ({habits.length})</span>
                </CardTitle>
                <CardDescription className={cn(
                  getCardDescriptionSize(),
                  getTruncateClass(),
                  "w-full"
                )}>
                  Manage and track all your habits in one place
                </CardDescription>
              </CardHeader>
              <CardContent className={cn("w-full", getCardContentPadding())}>
                {habitsLoading ? (
                  <div className="flex justify-center items-center py-8 w-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <HabitList 
                    userId={user?.id} 
                    onUpdate={triggerRefresh} 
                    refreshTrigger={refreshTrigger}
                    onEditHabit={handleEditHabit}
                    compact={isMobile}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 w-full">
            <div className="grid gap-4 w-full">
              <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
                <CardHeader className={cn("w-full", getCardHeaderPadding())}>
                  <CardTitle className={cn(
                    "flex items-center gap-1.5 w-full",
                    getCardTitleSize()
                  )}>
                    <BarChart3 className={cn(
                      isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                    )} />
                    <span className={getTruncateClass()}>Detailed Analytics</span>
                  </CardTitle>
                  <CardDescription className={cn(
                    getCardDescriptionSize(),
                    getTruncateClass(),
                    "w-full"
                  )}>
                    Comprehensive view of your habit performance
                  </CardDescription>
                </CardHeader>
                <CardContent className={cn("w-full", getCardContentPadding())}>
                  <WeeklyStreakChart 
                    userId={user?.id} 
                    refreshTrigger={refreshTrigger} 
                    detailed={true}
                    compact={isMobile}
                  />
                </CardContent>
              </Card>

              <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
                <CardHeader className={cn("w-full", getCardHeaderPadding())}>
                  <CardTitle className={cn(
                    "flex items-center gap-1.5 w-full",
                    getCardTitleSize()
                  )}>
                    <Calendar className={cn(
                      isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                    )} />
                    <span className={getTruncateClass()}>Weekly Streak Details</span>
                  </CardTitle>
                  <CardDescription className={cn(
                    getCardDescriptionSize(),
                    getTruncateClass(),
                    "w-full"
                  )}>
                    Day-by-day breakdown of your progress
                  </CardDescription>
                </CardHeader>
                <CardContent className={cn("w-full", getCardContentPadding())}>
                  <WeeklyStreakTable 
                    userId={user?.id} 
                    refreshTrigger={refreshTrigger}
                    compact={isMobile}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-4 w-full">
            <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
              <CardHeader className={cn("w-full", getCardHeaderPadding())}>
                <CardTitle className={cn(
                  "flex items-center gap-1.5 w-full",
                  getCardTitleSize()
                )}>
                  <Trophy className={cn(
                    isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                  )} />
                  <span className={getTruncateClass()}>Global Leaderboard</span>
                </CardTitle>
                <CardDescription className={cn(
                  getCardDescriptionSize(),
                  getTruncateClass(),
                  "w-full"
                )}>
                  Compete with others and stay motivated
                </CardDescription>
              </CardHeader>
              <CardContent className={cn("w-full", getCardContentPadding())}>
                <Leaderboard 
                  currentUserId={user?.id} 
                  refreshTrigger={refreshTrigger}
                  compact={isMobile}
                />
              </CardContent>
            </Card>

            <div className={cn(
              "grid gap-4 w-full",
              isMobile && !isPortrait ? "grid-cols-1" : "lg:grid-cols-2"
            )}>
              <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
                <CardHeader className={cn("w-full", getCardHeaderPadding())}>
                  <CardTitle className={cn(
                    "text-base w-full truncate",
                    getCardTitleSize()
                  )}>Your Ranking</CardTitle>
                  <CardDescription className={cn(
                    getCardDescriptionSize(),
                    getTruncateClass(),
                    "w-full"
                  )}>
                    See how you compare to others
                  </CardDescription>
                </CardHeader>
                <CardContent className={cn("w-full", getCardContentPadding())}>
                  <div className="text-center py-4 sm:py-6 w-full">
                    <Trophy className={cn(
                      "mx-auto mb-3 text-warning",
                      isMobile ? "w-8 h-8" : "w-10 h-10"
                    )} />
                    <p className={cn(
                      "font-bold text-warning w-full truncate",
                      isMobile ? "text-xl" : "text-2xl"
                    )}>
                      {userRank ? `#${userRank}` : 'Unranked'}
                    </p>
                    <p className="text-muted-foreground mt-1.5 text-xs sm:text-sm w-full truncate">
                      {userRank && userRank <= 3 ? "You're in the top 3! 🎉" : 
                       userRank && userRank <= 10 ? "You're in the top 10! 🎉" : 
                       dailyStats.streak > 0 ? "Keep going to climb the ranks!" : "Start completing habits to appear on the leaderboard!"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn("w-full", getCardPadding(), getCardWidth())}>
                <CardHeader className={cn("w-full", getCardHeaderPadding())}>
                  <CardTitle className={cn(
                    "text-base w-full truncate",
                    getCardTitleSize()
                  )}>Streak Stats</CardTitle>
                  <CardDescription className={cn(
                    getCardDescriptionSize(),
                    getTruncateClass(),
                    "w-full"
                  )}>
                    Your personal streak achievements
                  </CardDescription>
                </CardHeader>
                <CardContent className={cn("w-full", getCardContentPadding())}>
                  <div className="space-y-4 py-2 w-full">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm truncate flex-1">Current Streak</span>
                      <span className="font-bold text-lg flex-shrink-0 ml-2 truncate">{dailyStats.streak} days</span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm truncate flex-1">Best Streak</span>
                      <span className="font-bold text-lg flex-shrink-0 ml-2 truncate">{dailyStats.bestStreak} days</span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm truncate flex-1">Total Habits</span>
                      <span className="font-bold text-lg flex-shrink-0 ml-2 truncate">{dailyStats.total}</span>
                    </div>
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm truncate flex-1">Today's Progress</span>
                      <span className="font-bold text-lg flex-shrink-0 ml-2 truncate">{dailyStats.completionRate}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Sign Out Confirmation Dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? You'll need to sign in again to access your habits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="mt-2 sm:mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateHabitDialog 
        open={showCreateDialog} 
        onOpenChange={handleDialogClose}
        userId={user?.id}
        onHabitCreated={triggerRefresh}
        editHabit={editingHabit}
      />
    </div>
  );
};

export default Dashboard;