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
  const [dailyStats, setDailyStats] = useState({
    completed: 2,
    pending: 3,
    total: 5,
    streak: 2,
    completionRate: 40
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
      
      // Fetch user's daily stats
      await fetchDailyStats(session.user.id);
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      } else if (session) {
        setUser(session.user);
        fetchDailyStats(session.user.id);
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
      // Mock data - replace with actual API calls
      setDailyStats({
        completed: 2,
        pending: 3,
        total: 5,
        streak: 2,
        completionRate: 40
      });
    } catch (error) {
      console.error("Error fetching daily stats:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    setShowSignOutDialog(false);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEditHabit = (habit: any) => {
    setEditingHabit(habit);
    setShowCreateDialog(true);
  };

  const handleDialogClose = () => {
    setShowCreateDialog(false);
    setTimeout(() => setEditingHabit(null), 200);
  };

  // Responsive grid columns for daily stats
  const getStatsGridCols = () => {
    if (isMobile) {
      return isPortrait ? "grid-cols-3" : "grid-cols-3";
    }
    if (isTablet) {
      return "grid-cols-3";
    }
    return "grid-cols-3";
  };

  // Responsive container padding
  const getContainerPadding = () => {
    if (isMobile) {
      return isPortrait ? "px-3 py-3" : "px-4 py-4";
    }
    if (isTablet) {
      return "px-4 py-5";
    }
    return "px-4 py-6";
  };

  // Responsive card padding - fixed for mobile
  const getCardPadding = () => {
    if (isMobile) {
      return "p-3";
    }
    if (isTablet) {
      return "p-4";
    }
    return "p-5";
  };

  // Responsive card header padding
  const getCardHeaderPadding = () => {
    if (isMobile) {
      return "px-3 pt-3 pb-2";
    }
    if (isTablet) {
      return "px-4 pt-4 pb-3";
    }
    return "px-5 pt-5 pb-4";
  };

  // Responsive card content padding
  const getCardContentPadding = () => {
    if (isMobile) {
      return "px-3 pt-2 pb-3";
    }
    if (isTablet) {
      return "px-4 pt-3 pb-4";
    }
    return "px-5 pt-4 pb-5";
  };

  // Top 3 Podium Component with mobile sizing
  const TopThreePodium = () => {
    if (leaderboardLoading) {
      return (
        <div className="animate-pulse">
          <div className={cn(
            "flex items-end justify-center gap-2 py-4",
            isMobile && !isPortrait && "gap-1 py-3"
          )}>
            {[2, 1, 3].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <div className={cn(
                  "rounded-full bg-muted mb-2",
                  i === 1 ? "w-10 h-10" : "w-8 h-8",
                  isMobile && !isPortrait && i === 1 ? "w-8 h-8" : "w-6 h-6"
                )} />
                <div className={cn(
                  "bg-muted rounded-xl mb-1.5",
                  i === 1 ? "w-16 h-6" : "w-12 h-5",
                  isMobile && !isPortrait && i === 1 ? "w-12 h-5" : "w-10 h-4"
                )} />
                <div className={cn(
                  "bg-muted rounded",
                  isMobile ? "w-8 h-2" : "w-12 h-3",
                  isMobile && !isPortrait && "w-6 h-2"
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
          "py-4 text-center",
          isMobile && "py-3"
        )}>
          <p className="text-destructive mb-2 text-xs sm:text-sm">{leaderboardError}</p>
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
          "py-4 text-center",
          isMobile && "py-3"
        )}>
          <Trophy className={cn(
            "mx-auto mb-3 text-muted-foreground opacity-50",
            isMobile ? "w-8 h-8" : "w-10 h-10"
          )} />
          <p className="text-muted-foreground text-xs sm:text-sm">No leaderboard data</p>
          <p className="text-xs text-muted-foreground mt-1">
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
      <div className="space-y-3 sm:space-y-4">
        <div className={cn(
          "flex items-end justify-center gap-2",
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
                  "flex flex-col items-center",
                  actualIndex === 0 ? "order-2" : actualIndex === 1 ? "order-1" : "order-3"
                )}
              >
                <div className={cn(
                  "w-full rounded-t-lg mb-2 flex items-center justify-center",
                  height,
                  isMobile ? "max-w-12 sm:max-w-16" : "max-w-16",
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
                
                <div className="text-center min-w-0 max-w-full">
                  <h3 className={cn(
                    "font-semibold truncate px-1",
                    isMobile ? "text-xs" : "text-sm",
                    isMobile && !isPortrait && "text-xs"
                  )}>
                    {leader.username || leader.email?.split('@')[0] || 'User'}
                  </h3>
                  {leader.id === user?.id && (
                    <Badge variant="secondary" size="sm" className={cn(
                      "mt-0.5 bg-primary/20 text-primary text-[10px] px-1 h-4",
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
                    "mt-0.5 text-[10px] h-4",
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

  // User Stats Component with mobile sizing
  const UserStats = () => {
    const currentUser = leaderboardData.find(u => u.id === user?.id);
    const userStreak = currentUser?.total_streak || 0;
    
    return (
      <div className={cn(
        "mt-3 sm:mt-4 p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20",
        isMobile && !isPortrait && "p-2"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn(
              "rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0",
              isMobile ? "w-8 h-8" : "w-10 h-10"
            )}>
              <Trophy className={cn(
                "text-white",
                isMobile ? "w-4 h-4" : "w-5 h-5"
              )} />
            </div>
            <div className="min-w-0">
              <p className={cn(
                "text-muted-foreground truncate",
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
          <div className="text-right min-w-0">
            <p className={cn(
              "text-muted-foreground truncate",
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
          <div className="mt-2 pt-2 border-t border-primary/20">
            <p className="text-xs text-muted-foreground text-center">
              Complete habits to appear on the leaderboard!
            </p>
          </div>
        )}
      </div>
    );
  };

  // Daily Stats Component - Fixed mobile sizing
  const DailyStatsCard = () => (
    <div className={cn(
      "grid gap-2 mb-4",
      getStatsGridCols()
    )}>
      <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg p-2 border border-green-500/20">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-green-600 truncate">Completed</p>
            <p className="text-lg font-bold">{dailyStats.completed}</p>
          </div>
          <div className="p-1.5 bg-green-500/20 rounded-lg flex-shrink-0 ml-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">Of {dailyStats.total} total</p>
      </div>

      <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 rounded-lg p-2 border border-blue-500/20">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 truncate">Pending</p>
            <p className="text-lg font-bold">{dailyStats.pending}</p>
          </div>
          <div className="p-1.5 bg-blue-500/20 rounded-lg flex-shrink-0 ml-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">Remaining today</p>
      </div>

      <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-lg p-2 border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-purple-600 truncate">Streak</p>
            <p className="text-lg font-bold">{dailyStats.streak}</p>
          </div>
          <div className="p-1.5 bg-purple-500/20 rounded-lg flex-shrink-0 ml-1">
            <Flame className="w-3.5 h-3.5 text-purple-500" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 truncate">Consecutive days</p>
      </div>
    </div>
  );

  // Loading Skeletons - Responsive
  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      {/* Header Loading */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className={cn(
          "container mx-auto",
          isMobile ? "px-3 py-3" : "px-4 py-4"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={cn(
                "bg-muted rounded-md",
                isMobile ? "w-8 h-8" : "w-10 h-10"
              )}></div>
              <div className="hidden sm:block">
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
        "container mx-auto",
        getContainerPadding()
      )}>
        {/* Quick Actions Header Loading */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="space-y-2 min-w-0">
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
          "grid gap-2 mb-4",
          getStatsGridCols()
        )}>
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-muted/30 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
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
                "h-2.5 bg-muted rounded mt-1",
                isMobile ? "w-12" : "w-14"
              )}></div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left Column Loading */}
          <div className="space-y-4">
            <div className="bg-card rounded-lg p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-muted rounded"></div>
                  <div className={cn(
                    "h-4 bg-muted rounded",
                    isMobile ? "w-20" : "w-24"
                  )}></div>
                </div>
                <div className={cn(
                  "h-3 bg-muted rounded",
                  isMobile ? "w-32" : "w-36"
                )}></div>
                <div className="h-32 bg-muted/30 rounded-lg mt-3"></div>
              </div>
            </div>
          </div>

          {/* Right Column Loading */}
          <div className="space-y-4">
            <div className="bg-card rounded-lg p-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-muted rounded"></div>
                  <div className={cn(
                    "h-4 bg-muted rounded",
                    isMobile ? "w-28" : "w-32"
                  )}></div>
                </div>
                <div className={cn(
                  "h-3 bg-muted rounded",
                  isMobile ? "w-20" : "w-24"
                )}></div>
                <div className="flex items-end justify-center gap-2 py-4">
                  {[2, 1, 3].map((i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className={cn(
                        "rounded-full bg-muted mb-2",
                        i === 1 ? "w-10 h-10" : "w-8 h-8"
                      )} />
                      <div className={cn(
                        "bg-muted rounded-xl mb-1.5",
                        i === 1 ? "w-16 h-6" : "w-12 h-5"
                      )} />
                      <div className="bg-muted rounded w-10 h-2.5" />
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
      <div className="min-h-screen bg-background">
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
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6 sm:mb-8">
            <div className="p-2 bg-gradient-to-br from-primary to-primary/80 rounded-lg">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-br from-primary to-primary/80 bg-clip-text text-transparent truncate">
                StreakMaster
              </h1>
              <p className="text-xs text-muted-foreground truncate">Completion Habits Tracking</p>
            </div>
          </div>
          
          <div className="flex-1 space-y-2 sm:space-y-4">
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
          
          <div className="pt-4 sm:pt-6 border-t">
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
      <div className="flex items-center justify-center mb-2">
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <header className={cn(
        "border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 transition-all duration-300",
        isMobile && !isPortrait && isCollapsed ? "h-0 border-0 overflow-hidden" : "py-2 sm:py-4"
      )}>
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between">
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
        "container mx-auto",
        getContainerPadding()
      )}>
        {/* Dashboard Header */}
        <div className={cn(
          "flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 mb-4",
          isMobile && !isPortrait && "flex-row items-center mb-3"
        )}>
          <div className={cn(
            "min-w-0",
            isMobile && !isPortrait && "flex-1"
          )}>
            <h1 className={cn(
              "font-bold tracking-tight truncate",
              isMobile && !isPortrait ? "text-lg" : "text-xl sm:text-2xl"
            )}>Dashboard</h1>
            <p className={cn(
              "text-muted-foreground truncate",
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* Desktop Tabs */}
          <TabsList className={cn(
            "hidden sm:grid gap-2 p-1 bg-muted/50 rounded-lg",
            isTablet ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
          )}>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className={cn(isTablet && "hidden lg:inline")}>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="habits" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              <span className={cn(isTablet && "hidden lg:inline")}>My Habits</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span className={cn(isTablet && "hidden lg:inline")}>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <span className={cn(isTablet && "hidden lg:inline")}>Leaderboard</span>
            </TabsTrigger>
          </TabsList>

          {/* Mobile Tab Switcher */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-9 text-sm">
                  <div className="flex items-center gap-2">
                    {activeTab === "overview" && <BarChart3 className="w-3.5 h-3.5" />}
                    {activeTab === "habits" && <List className="w-3.5 h-3.5" />}
                    {activeTab === "analytics" && <Target className="w-3.5 h-3.5" />}
                    {activeTab === "leaderboard" && <Trophy className="w-3.5 h-3.5" />}
                    <span className="capitalize text-sm truncate">
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
                <DropdownMenuItem onClick={() => setActiveTab("overview")} className="text-sm">
                  <BarChart3 className="w-3.5 h-3.5 mr-2" />
                  Overview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("habits")} className="text-sm">
                  <List className="w-3.5 h-3.5 mr-2" />
                  My Habits
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("analytics")} className="text-sm">
                  <Target className="w-3.5 h-3.5 mr-2" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("leaderboard")} className="text-sm">
                  <Trophy className="w-3.5 h-3.5 mr-2" />
                  Leaderboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Overview Tab - Fixed mobile sizing */}
          <TabsContent value="overview" className="space-y-4">
            <div className={cn(
              "grid gap-4",
              isMobile && !isPortrait ? "grid-cols-1" : "lg:grid-cols-2"
            )}>
              {/* Left Column - Progress & Analytics */}
              <div className="space-y-4">
                <Card className={cn(getCardPadding())}>
                  <CardHeader className={cn("pb-2", getCardHeaderPadding())}>
                    <CardTitle className={cn(
                      "flex items-center gap-1.5",
                      isMobile ? "text-base" : "text-lg"
                    )}>
                      <BarChart3 className={cn(
                        isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                      )} />
                      Today's Progress
                    </CardTitle>
                    <CardDescription className={cn(
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      Your completion rate for today
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={getCardContentPadding()}>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-sm font-medium">Daily Completion</span>
                            <p className="text-xs text-muted-foreground">
                              {dailyStats.completed} of {dailyStats.total} habits completed
                            </p>
                          </div>
                          <span className={cn(
                            "font-bold",
                            isMobile ? "text-lg" : "text-xl"
                          )}>{dailyStats.completionRate}%</span>
                        </div>
                        <Progress value={dailyStats.completionRate} className="h-2" />
                      </div>
                      
                      <Separator className="my-2" />

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/20 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Activity className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium">Active Habits</span>
                          </div>
                          <p className="text-xl font-bold">{dailyStats.total}</p>
                        </div>
                        <div className="bg-muted/20 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <TrendingUpIcon className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium">Best Streak</span>
                          </div>
                          <p className="text-xl font-bold">14 days</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn(getCardPadding())}>
                  <CardHeader className={cn("pb-2", getCardHeaderPadding())}>
                    <CardTitle className={cn(
                      "flex items-center gap-1.5",
                      isMobile ? "text-base" : "text-lg"
                    )}>
                      <Calendar className={cn(
                        isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                      )} />
                      Weekly Progress
                    </CardTitle>
                    <CardDescription className={cn(
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      Your streak performance this week
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={getCardContentPadding()}>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Daily habit completion rate</p>
                        <WeeklyStreakChart 
                          userId={user?.id} 
                          refreshTrigger={refreshTrigger}
                          compact={isMobile}
                        />
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1.5">Weekly Insights</p>
                        <ul className="space-y-1">
                          <li className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                            <span>Most productive day: Tuesday</span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                            <span>Average daily completion: 68%</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Leaderboard & Activity */}
              <div className="space-y-4">
                <Card className={cn(getCardPadding())}>
                  <CardHeader className={cn("pb-2", getCardHeaderPadding())}>
                    <CardTitle className={cn(
                      "flex items-center gap-1.5",
                      isMobile ? "text-base" : "text-lg"
                    )}>
                      <Trophy className={cn(
                        isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                      )} />
                      Top Performers
                    </CardTitle>
                    <CardDescription className={cn(
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      Leaderboard podium
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={getCardContentPadding()}>
                    <TopThreePodium />
                    <UserStats />
                  </CardContent>
                </Card>

                <Card className={cn(getCardPadding())}>
                  <CardHeader className={cn("pb-2", getCardHeaderPadding())}>
                    <CardTitle className={cn(
                      "flex items-center gap-1.5",
                      isMobile ? "text-base" : "text-lg"
                    )}>
                      <Activity className={cn(
                        isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                      )} />
                      Recent Activity
                    </CardTitle>
                    <CardDescription className={cn(
                      isMobile ? "text-xs" : "text-sm"
                    )}>
                      Your latest habit completions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={getCardContentPadding()}>
                    <RecentActivity 
                      userId={user?.id} 
                      refreshTrigger={refreshTrigger}
                      compact={isMobile}
                    />
                    
                    <div className="mt-3 pt-3 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full text-xs h-7"
                        onClick={() => setActiveTab("habits")}
                      >
                        View All Habits
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Other Tabs with fixed mobile sizing */}
          <TabsContent value="habits" className="space-y-4">
            <Card className={cn(getCardPadding())}>
              <CardHeader className={getCardHeaderPadding()}>
                <CardTitle className={cn(
                  "flex items-center gap-1.5",
                  isMobile ? "text-base" : "text-lg"
                )}>
                  <List className={cn(
                    isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                  )} />
                  Your Habits
                </CardTitle>
                <CardDescription className={cn(
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Manage and track all your habits in one place
                </CardDescription>
              </CardHeader>
              <CardContent className={getCardContentPadding()}>
                <HabitList 
                  userId={user?.id} 
                  onUpdate={triggerRefresh} 
                  refreshTrigger={refreshTrigger}
                  onEditHabit={handleEditHabit}
                  compact={isMobile}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4">
              <Card className={cn(getCardPadding())}>
                <CardHeader className={getCardHeaderPadding()}>
                  <CardTitle className={cn(
                    "flex items-center gap-1.5",
                    isMobile ? "text-base" : "text-lg"
                  )}>
                    <BarChart3 className={cn(
                      isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                    )} />
                    Detailed Analytics
                  </CardTitle>
                  <CardDescription className={cn(
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    Comprehensive view of your habit performance
                  </CardDescription>
                </CardHeader>
                <CardContent className={getCardContentPadding()}>
                  <WeeklyStreakChart 
                    userId={user?.id} 
                    refreshTrigger={refreshTrigger} 
                    detailed={true}
                    compact={isMobile}
                  />
                </CardContent>
              </Card>

              <Card className={cn(getCardPadding())}>
                <CardHeader className={getCardHeaderPadding()}>
                  <CardTitle className={cn(
                    "flex items-center gap-1.5",
                    isMobile ? "text-base" : "text-lg"
                  )}>
                    <Calendar className={cn(
                      isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                    )} />
                    Weekly Streak Details
                  </CardTitle>
                  <CardDescription className={cn(
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    Day-by-day breakdown of your progress
                  </CardDescription>
                </CardHeader>
                <CardContent className={getCardContentPadding()}>
                  <WeeklyStreakTable 
                    userId={user?.id} 
                    refreshTrigger={refreshTrigger}
                    compact={isMobile}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-4">
            <Card className={cn(getCardPadding())}>
              <CardHeader className={getCardHeaderPadding()}>
                <CardTitle className={cn(
                  "flex items-center gap-1.5",
                  isMobile ? "text-base" : "text-lg"
                )}>
                  <Trophy className={cn(
                    isMobile ? "w-3.5 h-3.5" : "w-4 h-4"
                  )} />
                  Global Leaderboard
                </CardTitle>
                <CardDescription className={cn(
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  Compete with others and stay motivated
                </CardDescription>
              </CardHeader>
              <CardContent className={getCardContentPadding()}>
                <Leaderboard 
                  currentUserId={user?.id} 
                  refreshTrigger={refreshTrigger}
                  compact={isMobile}
                />
              </CardContent>
            </Card>

            <div className={cn(
              "grid gap-4",
              isMobile && !isPortrait ? "grid-cols-1" : "lg:grid-cols-2"
            )}>
              <Card className={cn(getCardPadding())}>
                <CardHeader className={getCardHeaderPadding()}>
                  <CardTitle className={cn(
                    isMobile ? "text-base" : "text-lg"
                  )}>Your Ranking</CardTitle>
                  <CardDescription className={cn(
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    See how you compare to others
                  </CardDescription>
                </CardHeader>
                <CardContent className={getCardContentPadding()}>
                  <div className="text-center py-4 sm:py-6">
                    <Trophy className={cn(
                      "mx-auto mb-3 text-warning",
                      isMobile ? "w-8 h-8" : "w-10 h-10"
                    )} />
                    <p className={cn(
                      "font-bold text-warning",
                      isMobile ? "text-xl" : "text-2xl"
                    )}>
                      {userRank ? `#${userRank}` : 'Unranked'}
                    </p>
                    <p className="text-muted-foreground mt-1.5 text-xs sm:text-sm">
                      {userRank && userRank <= 3 ? "You're in the top 3! 🎉" : 
                       userRank && userRank <= 10 ? "You're in the top 10! 🎉" : "Keep going to climb the ranks!"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className={cn(getCardPadding())}>
                <CardHeader className={getCardHeaderPadding()}>
                  <CardTitle className={cn(
                    isMobile ? "text-base" : "text-lg"
                  )}>Achievements</CardTitle>
                  <CardDescription className={cn(
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    Unlock achievements as you progress
                  </CardDescription>
                </CardHeader>
                <CardContent className={getCardContentPadding()}>
                  <div className="text-center py-4 sm:py-6">
                    <Target className={cn(
                      "mx-auto mb-3 text-muted-foreground opacity-50",
                      isMobile ? "w-8 h-8" : "w-10 h-10"
                    )} />
                    <p className="text-muted-foreground text-xs sm:text-sm">
                      Achievements coming soon!
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Complete more habits to unlock achievements
                    </p>
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