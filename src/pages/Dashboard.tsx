import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, LogOut, Plus, Trophy, BarChart3, Calendar, List, Target, Menu, Medal, Crown, Award } from "lucide-react";
import { toast } from "sonner";
import { HabitList } from "@/components/HabitList";
import { StatsOverview } from "@/components/StatsOverview";
import { Leaderboard } from "@/components/Leaderboard";
import { CreateHabitDialog } from "@/components/CreateHabitDialog";
import { WeeklyStreakChart } from "@/components/WeeklyStreakChart";
import { WeeklyStreakTable } from "@/components/WeeklyStreakTable";
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

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate("/auth");
      } else if (session) {
        setUser(session.user);
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
        // Fetch from profiles table like in Leaderboard.tsx
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .gt('total_streak', 0) // Only include profiles with streak > 0
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
          
          // Find current user's rank
          if (data) {
            // First check if user has any streaks
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('total_streak')
              .eq('id', user.id)
              .single();

            if (userProfile && userProfile.total_streak > 0) {
              // Find user's rank in the sorted data
              const userIndex = data.findIndex(p => p.id === user.id);
              if (userIndex !== -1) {
                setUserRank(userIndex + 1);
              } else {
                // User has streak > 0 but not in top 10, calculate their actual rank
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

    // Set up polling every 30 seconds as fallback
    pollInterval = setInterval(fetchLeaderboard, 30000);

    // Set up real-time subscription for profiles table
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
            // Check if this update affects the current user
            if (payload.new.id === user.id) {
              // Refresh leaderboard if user's streak changed
              fetchLeaderboard();
            } else {
              // Optimistically update the leaderboard for other users
              setLeaderboardData(prev => {
                const updatedData = [...prev];
                const index = updatedData.findIndex(u => u.id === payload.new.id);
                
                if (index !== -1) {
                  updatedData[index] = { ...updatedData[index], ...payload.new };
                }
                
                // Re-sort the array
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Flame className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
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
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                StreakMaster
              </h1>
              <p className="text-xs text-muted-foreground">Competitive Habit Tracking</p>
            </div>
          </div>
          
          <div className="flex-1 space-y-4">
            <Button
              variant={activeTab === "overview" ? "secondary" : "ghost"}
              className="w-full justify-start"
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
              className="w-full justify-start"
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
              className="w-full justify-start"
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
              className="w-full justify-start"
              onClick={() => {
                setActiveTab("leaderboard");
                setIsMobileMenuOpen(false);
              }}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </Button>
          </div>
          
          <div className="pt-6 border-t">
            <Button 
              variant="destructive" 
              className="w-full"
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

  // Top 3 Podium Component - Updated to match Leaderboard.tsx
  const TopThreePodium = () => {
    if (leaderboardLoading) {
      return (
        <div className="flex items-center justify-center gap-4 py-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted animate-pulse mb-3" />
              <div className="bg-muted rounded-xl w-24 h-8 sm:w-32 sm:h-10 animate-pulse" />
            </div>
          ))}
        </div>
      );
    }

    if (leaderboardError) {
      return (
        <div className="py-6 text-center">
          <p className="text-destructive mb-2">{leaderboardError}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      );
    }

    const top3 = leaderboardData.slice(0, 3);
    
    if (top3.length === 0) {
      return (
        <div className="py-6 text-center">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No leaderboard data available</p>
        </div>
      );
    }
    
    const getRankIcon = (rank: number) => {
      const baseClass = "flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full";
      
      switch (rank) {
        case 1:
          return (
            <div className={`${baseClass} bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-lg`}>
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          );
        case 2:
          return (
            <div className={`${baseClass} bg-gradient-to-br from-gray-300 to-gray-400`}>
              <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          );
        case 3:
          return (
            <div className={`${baseClass} bg-gradient-to-br from-orange-300 to-orange-500`}>
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          );
        default:
          return null;
      }
    };

    // For responsive layout - desktop shows side-by-side, mobile shows stacked
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Desktop Podium - Grid Layout */}
        <div className="hidden lg:grid grid-cols-3 gap-4 py-4">
          {top3.length >= 3 ? (
            // Full podium with 3 positions
            <>
              {/* Second Place */}
              <div 
                className={`rounded-xl p-4 shadow-lg border ${
                  top3[1] ? 'bg-gradient-to-b from-gray-500/20 to-transparent border-gray-500/30 order-1 mt-6' : ''
                }`}
              >
                {top3[1] && (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3">
                      {getRankIcon(2)}
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate w-full">
                      {top3[1].username || top3[1].email?.split('@')[0] || 'User'}
                    </h3>
                    {top3[1].id === user?.id && (
                      <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                        You
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      <Flame className="w-4 h-4 text-warning" />
                      <span className="text-2xl font-bold">{top3[1].total_streak || 0}</span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      #2
                    </Badge>
                  </div>
                )}
              </div>

              {/* First Place */}
              <div 
                className={`rounded-xl p-4 shadow-lg border ${
                  top3[0] ? 'bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30 order-2' : ''
                }`}
              >
                {top3[0] && (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3">
                      {getRankIcon(1)}
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate w-full">
                      {top3[0].username || top3[0].email?.split('@')[0] || 'User'}
                    </h3>
                    {top3[0].id === user?.id && (
                      <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                        You
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      <Flame className="w-4 h-4 text-warning" />
                      <span className="text-2xl font-bold">{top3[0].total_streak || 0}</span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      #1
                    </Badge>
                  </div>
                )}
              </div>

              {/* Third Place */}
              <div 
                className={`rounded-xl p-4 shadow-lg border ${
                  top3[2] ? 'bg-gradient-to-b from-orange-500/20 to-transparent border-orange-500/30 order-3 mt-6' : ''
                }`}
              >
                {top3[2] && (
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3">
                      {getRankIcon(3)}
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate w-full">
                      {top3[2].username || top3[2].email?.split('@')[0] || 'User'}
                    </h3>
                    {top3[2].id === user?.id && (
                      <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                        You
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 mb-2">
                      <Flame className="w-4 h-4 text-warning" />
                      <span className="text-2xl font-bold">{top3[2].total_streak || 0}</span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      #3
                    </Badge>
                  </div>
                )}
              </div>
            </>
          ) : (
            // Partial podium with fewer than 3 positions
            <div className="col-span-3">
              <div className="flex justify-center items-center gap-4">
                {top3.map((leader, index) => {
                  const displayName = leader.username || leader.email?.split('@')[0] || 'User';
                  
                  return (
                    <div 
                      key={leader.id}
                      className={`rounded-xl p-4 shadow-lg border ${
                        index === 0 ? 'bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30' :
                        'bg-gradient-to-b from-gray-500/20 to-transparent border-gray-500/30'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-3">
                          {getRankIcon(index + 1)}
                        </div>
                        <h3 className="font-bold text-lg mb-1">{displayName}</h3>
                        {leader.id === user?.id && (
                          <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                            You
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 mb-2">
                          <Flame className="w-4 h-4 text-warning" />
                          <span className="text-2xl font-bold">{leader.total_streak || 0}</span>
                        </div>
                        <Badge variant="secondary" className="text-sm">
                          #{index + 1}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Podium - Carousel/Stack Layout */}
        <div className="lg:hidden">
          <div className="flex flex-col items-center gap-4 py-4">
            {/* First Place (centered on mobile) */}
            {top3[0] && (
              <div 
                className={`rounded-xl p-4 shadow-lg border w-full max-w-xs ${
                  'bg-gradient-to-b from-yellow-500/20 to-transparent border-yellow-500/30'
                }`}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="mb-3">
                    {getRankIcon(1)}
                  </div>
                  <h3 className="font-bold text-lg mb-1">
                    {top3[0].username || top3[0].email?.split('@')[0] || 'User'}
                  </h3>
                  {top3[0].id === user?.id && (
                    <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                      You
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 mb-2">
                    <Flame className="w-4 h-4 text-warning" />
                    <span className="text-2xl font-bold">{top3[0].total_streak || 0}</span>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    #1
                  </Badge>
                </div>
              </div>
            )}

            {/* 2nd and 3rd places side by side on mobile */}
            {(top3[1] || top3[2]) && (
              <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                {/* Second Place */}
                {top3[1] && (
                  <div 
                    className={`rounded-xl p-4 shadow-lg border ${
                      'bg-gradient-to-b from-gray-500/20 to-transparent border-gray-500/30'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3">
                        {getRankIcon(2)}
                      </div>
                      <h3 className="font-bold text-base mb-1 truncate w-full">
                        {top3[1].username || top3[1].email?.split('@')[0] || 'User'}
                      </h3>
                      {top3[1].id === user?.id && (
                        <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                          You
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 mb-2">
                        <Flame className="w-3 h-3 text-warning" />
                        <span className="text-xl font-bold">{top3[1].total_streak || 0}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        #2
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Third Place */}
                {top3[2] && (
                  <div 
                    className={`rounded-xl p-4 shadow-lg border ${
                      'bg-gradient-to-b from-orange-500/20 to-transparent border-orange-500/30'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className="mb-3">
                        {getRankIcon(3)}
                      </div>
                      <h3 className="font-bold text-base mb-1 truncate w-full">
                        {top3[2].username || top3[2].email?.split('@')[0] || 'User'}
                      </h3>
                      {top3[2].id === user?.id && (
                        <Badge variant="secondary" size="sm" className="mb-2 bg-primary/20 text-primary">
                          You
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 mb-2">
                        <Flame className="w-3 h-3 text-warning" />
                        <span className="text-xl font-bold">{top3[2].total_streak || 0}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        #3
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Legend for mobile */}
        <div className="lg:hidden mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3 text-center">LEGEND</p>
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Crown className="w-2 h-2 text-yellow-600" />
              </div>
              <span>1st Place</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500/20 flex items-center justify-center">
                <Medal className="w-2 h-2 text-gray-600" />
              </div>
              <span>2nd Place</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Award className="w-2 h-2 text-orange-600" />
              </div>
              <span>3rd Place</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // User Stats Component
  const UserStats = () => {
    const currentUser = leaderboardData.find(u => u.id === user?.id);
    const userStreak = currentUser?.total_streak || 0;
    
    if (leaderboardLoading) {
      return (
        <div className="mt-4 p-4 bg-muted/30 rounded-lg border-2 border-primary/20 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted" />
              <div>
                <div className="h-3 w-16 bg-muted rounded mb-2" />
                <div className="h-6 w-8 bg-muted rounded" />
              </div>
            </div>
            <div>
              <div className="h-3 w-20 bg-muted rounded mb-2" />
              <div className="h-6 w-10 bg-muted rounded" />
            </div>
          </div>
        </div>
      );
    }

    if (leaderboardError) {
      return (
        <div className="mt-4 p-4 bg-destructive/10 rounded-lg border-2 border-destructive/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-destructive">Error loading rank</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => setRefreshTrigger(prev => prev + 1)}
                  className="p-0 h-auto text-xs"
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="mt-4 p-4 bg-muted/30 rounded-lg border-2 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-primary flex items-center justify-center">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Your Rank</p>
              <p className="text-lg sm:text-2xl font-bold">
                {userRank ? `#${userRank}` : userStreak > 0 ? 'Ranking...' : 'Unranked'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs sm:text-sm text-muted-foreground">Total Streaks</p>
            <p className="text-lg sm:text-2xl font-bold text-primary">
              {userStreak || 0}
            </p>
          </div>
        </div>
        
        {userStreak === 0 && (
          <div className="mt-3 pt-3 border-t border-primary/20">
            <p className="text-xs text-muted-foreground">
              Complete habits for 1 day to appear on the leaderboard!
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <MobileNavigation />
              <div className="hidden sm:flex p-2 bg-gradient-primary rounded-lg">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div className="sm:hidden p-1.5 bg-gradient-primary rounded-md">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  StreakMaster
                </h1>
                <p className="text-xs text-muted-foreground">Competitive Habit Tracking</p>
              </div>
            </div>
            
            <div className="hidden lg:flex items-center justify-center w-full gap-4">
              <div className="text-center">
                {/* Welcome message can be added here */}
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:block">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowSignOutDialog(true)}
                  className="hidden sm:flex"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowSignOutDialog(true)}
                  className="sm:hidden"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Quick Actions Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold">Dashboard</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Track your progress and build better habits
            </p>
          </div>
          <Button 
            onClick={() => {
              setEditingHabit(null);
              setShowCreateDialog(true);
            }}
            className="bg-gradient-primary w-full sm:w-auto"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>New Habit</span>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          {/* Desktop Tabs */}
          <TabsList className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-2 p-1 bg-muted/50 rounded-lg">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="habits" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              <span>My Habits</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              <span>Leaderboard</span>
            </TabsTrigger>
          </TabsList>

          {/* Mobile Tab Switcher */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    {activeTab === "overview" && <BarChart3 className="w-4 h-4" />}
                    {activeTab === "habits" && <List className="w-4 h-4" />}
                    {activeTab === "analytics" && <Target className="w-4 h-4" />}
                    {activeTab === "leaderboard" && <Trophy className="w-4 h-4" />}
                    <span className="capitalize">
                      {activeTab === "overview" && "Overview"}
                      {activeTab === "habits" && "My Habits"}
                      {activeTab === "analytics" && "Analytics"}
                      {activeTab === "leaderboard" && "Leaderboard"}
                    </span>
                  </div>
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[calc(100vw-2rem)]">
                <DropdownMenuItem onClick={() => setActiveTab("overview")}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Overview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("habits")}>
                  <List className="w-4 h-4 mr-2" />
                  My Habits
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("analytics")}>
                  <Target className="w-4 h-4 mr-2" />
                  Analytics
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("leaderboard")}>
                  <Trophy className="w-4 h-4 mr-2" />
                  Leaderboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              {/* Left Column */}
              <div className="space-y-4 sm:space-y-6">
                <Card>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                      <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                      Quick Stats
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      Your habit tracking overview
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <StatsOverview userId={user?.id} refreshTrigger={refreshTrigger} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                      Weekly Progress
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      Your streak performance this week
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <WeeklyStreakChart userId={user?.id} refreshTrigger={refreshTrigger} />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-4 sm:space-y-6">
                <Card>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                      Top Performers
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      Champion podium and your ranking
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TopThreePodium />
                    <UserStats />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3 sm:pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                      Recent Activity
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">
                      Your latest habit completions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-6 sm:py-8">
                      <Target className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground opacity-50" />
                      <p className="text-sm sm:text-base text-muted-foreground">
                        Recent activity will appear here
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Habits Tab */}
          <TabsContent value="habits" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <List className="w-4 h-4 sm:w-5 sm:h-5" />
                  Your Habits
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Manage and track all your habits in one place
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HabitList 
                  userId={user?.id} 
                  onUpdate={triggerRefresh} 
                  refreshTrigger={refreshTrigger}
                  onEditHabit={handleEditHabit}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4 sm:space-y-6">
            <div className="grid gap-4 sm:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
                    Detailed Analytics
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    Comprehensive view of your habit performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WeeklyStreakChart userId={user?.id} refreshTrigger={refreshTrigger} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                    Weekly Streak Details
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    Day-by-day breakdown of your progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WeeklyStreakTable userId={user?.id} refreshTrigger={refreshTrigger} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                  Global Leaderboard
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Compete with others and stay motivated
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Leaderboard 
                  currentUserId={user?.id} 
                  refreshTrigger={refreshTrigger}
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Your Ranking</CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    See how you compare to others
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6 sm:py-8">
                    <Trophy className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-warning" />
                    <p className="text-2xl font-bold text-warning">
                      {userRank ? `#${userRank}` : 'Unranked'}
                    </p>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {userRank && userRank <= 3 ? "You're in the top 3! 🎉" : 
                       userRank && userRank <= 10 ? "You're in the top 10! 🎉" : "Keep going!"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Achievements</CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    Unlock achievements as you progress
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-6 sm:py-8">
                    <Target className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground opacity-50" />
                    <p className="text-sm sm:text-base text-muted-foreground">
                      Achievements coming soon!
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