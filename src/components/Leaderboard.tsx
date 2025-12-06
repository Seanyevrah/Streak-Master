import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Flame, TrendingUp, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface LeaderboardProps {
  currentUserId?: string;
  refreshTrigger?: number;
}

type TimeFilter = 'all-time' | 'weekly' | 'monthly';

export const Leaderboard = ({ currentUserId, refreshTrigger }: LeaderboardProps) => {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all-time');
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);
    
    try {
      // Fetch all profiles with non-zero streaks for ranking
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .gt('total_streak', 0) // Only include profiles with streak > 0
        .order('total_streak', { ascending: false });

      if (allProfiles) {
        // Get top 10 for display
        const top10 = allProfiles.slice(0, 10);
        setLeaders(top10);
        
        // Find current user's rank and data (even if streak is 0)
        if (currentUserId) {
          // Fetch current user's data separately to include even if streak is 0
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUserId)
            .single();
          
          if (userProfile) {
            setCurrentUserData(userProfile);
            
            // Calculate user's rank based on all profiles with streak > 0
            if (userProfile.total_streak > 0) {
              const userIndex = allProfiles.findIndex(p => p.id === currentUserId);
              if (userIndex !== -1) {
                setCurrentUserRank(userIndex + 1);
              } else {
                // User has streak > 0 but not in top list, rank is total count
                setCurrentUserRank(allProfiles.length + 1);
              }
            } else {
              // User has 0 streak, set rank to null
              setCurrentUserRank(null);
            }
          }
        }
      } else {
        setLeaders([]);
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    const channel = supabase
      .channel('leaderboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchLeaderboard)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, refreshTrigger, timeFilter]);

  const getRankIcon = (rank: number) => {
    const baseClass = "flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full";
    
    switch (rank) {
      case 1:
        return (
          <div className={`${baseClass} bg-yellow-500/20 text-yellow-600`}>
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      case 2:
        return (
          <div className={`${baseClass} bg-gray-500/20 text-gray-600`}>
            <Medal className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      case 3:
        return (
          <div className={`${baseClass} bg-orange-500/20 text-orange-600`}>
            <Award className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      default:
        return (
          <div className={`${baseClass} bg-muted text-muted-foreground font-bold`}>
            <span className="text-sm sm:text-base">{rank}</span>
          </div>
        );
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1: return "bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 text-yellow-700";
      case 2: return "bg-gradient-to-r from-gray-500/20 to-gray-600/10 text-gray-700";
      case 3: return "bg-gradient-to-r from-orange-500/20 to-orange-600/10 text-orange-700";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Loading Skeletons
  const LoadingSkeleton = () => (
    <>
      {/* Header Loading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 animate-pulse">
        <div className="space-y-2">
          <div className="h-6 bg-muted rounded w-32"></div>
          <div className="h-4 bg-muted rounded w-48"></div>
        </div>
        <div className="hidden sm:block">
          <div className="w-[140px] h-10 bg-muted rounded"></div>
        </div>
      </div>

      {/* Mobile Tabs Loading */}
      <div className="sm:hidden mb-4 animate-pulse">
        <div className="grid grid-cols-3 gap-1 w-full">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </div>

      {/* Top 3 Podium Loading - Desktop */}
      <div className="hidden lg:block mb-6 animate-pulse">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((item) => (
            <div 
              key={item}
              className={`rounded-xl p-4 shadow-lg bg-muted/50 ${
                item === 1 ? 'order-2' : 'mt-6'
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-10 h-10 bg-muted rounded-full mb-3"></div>
                <div className="h-5 bg-muted rounded w-24 mb-2"></div>
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-4 h-4 bg-muted rounded"></div>
                  <div className="h-8 bg-muted rounded w-8"></div>
                </div>
                <div className="h-6 bg-muted rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard List Loading */}
      <div className="space-y-2 sm:space-y-3 max-h-[300px] overflow-y-auto pr-1 sm:pr-2 mb-4">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="animate-pulse">
            {/* Mobile Item Loading */}
            <div className="lg:hidden">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card shadow-sm">
                <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-4 bg-muted rounded w-20"></div>
                    <div className="h-5 bg-muted rounded w-8"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-muted rounded"></div>
                      <div className="h-4 bg-muted rounded w-6"></div>
                      <div className="h-3 bg-muted rounded w-12"></div>
                    </div>
                    <div className="h-6 bg-muted rounded w-8"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Item Loading */}
            <div className="hidden lg:block">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-card hover:bg-muted/50">
                <div className="w-10 h-10 bg-muted rounded-full flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-5 bg-muted rounded w-24"></div>
                    <div className="h-6 bg-muted rounded w-12"></div>
                    <div className="ml-auto h-6 bg-muted rounded w-16"></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 bg-muted rounded flex-1"></div>
                    <div className="flex items-center gap-1 min-w-[80px]">
                      <div className="w-4 h-4 bg-muted rounded"></div>
                      <div className="h-5 bg-muted rounded w-6"></div>
                      <div className="h-4 bg-muted rounded w-12"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Current User Stats Loading */}
      <div className="animate-pulse">
        <div className="bg-gradient-primary/5 border-primary/20 rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-32"></div>
              <div className="h-4 bg-muted rounded w-24"></div>
            </div>
            <div className="h-8 bg-muted rounded w-16"></div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-lg p-3">
                <div className="h-4 bg-muted rounded w-16 mb-2"></div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-muted rounded"></div>
                  <div className="h-8 bg-muted rounded w-12"></div>
                </div>
              </div>
              
              <div className="bg-card rounded-lg p-3">
                <div className="h-4 bg-muted rounded w-20 mb-2"></div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-muted rounded"></div>
                  <div className="h-8 bg-muted rounded w-8"></div>
                </div>
              </div>
            </div>
            
            <div>
              <div className="h-3 bg-muted rounded w-full mb-2"></div>
              <div className="h-2 bg-muted rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend Loading */}
      <div className="mt-6 pt-4 border-t animate-pulse">
        <div className="flex flex-wrap gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted rounded-full"></div>
              <div className="h-3 bg-muted rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  // Mobile leaderboard item
  const MobileLeaderItem = ({ leader, rank }: { leader: any, rank: number }) => {
    const isCurrentUser = leader.id === currentUserId;
    
    return (
      <div
        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
          isCurrentUser 
            ? 'bg-gradient-primary/10 border border-primary/20 shadow-sm' 
            : 'bg-card shadow-sm'
        }`}
      >
        {/* Rank */}
        <div className="flex-shrink-0">
          {getRankIcon(rank)}
        </div>
        
        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm truncate">
              {leader.username}
            </span>
            {isCurrentUser && (
              <Badge variant="secondary" size="sm" className="text-xs">
                You
              </Badge>
            )}
          </div>
          
          {/* Stats */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-warning" />
              <span className="text-sm font-bold">{leader.total_streak || 0}</span>
              <span className="text-xs text-muted-foreground">streak</span>
            </div>
            
            <Badge 
              variant="outline" 
              className={`text-xs ${getRankBadgeColor(rank)}`}
            >
              #{rank}
            </Badge>
          </div>
        </div>
      </div>
    );
  };

  // Desktop leaderboard item
  const DesktopLeaderItem = ({ leader, rank }: { leader: any, rank: number }) => {
    const isCurrentUser = leader.id === currentUserId;
    
    return (
      <div
        className={`flex items-center gap-4 p-4 rounded-xl transition-all hover:bg-muted/50 ${
          isCurrentUser 
            ? 'bg-gradient-primary/10 border border-primary/20' 
            : 'bg-card'
        }`}
      >
        {/* Rank */}
        <div className="flex-shrink-0">
          {getRankIcon(rank)}
        </div>
        
        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-semibold text-base truncate">
              {leader.username}
            </span>
            {isCurrentUser && (
              <Badge variant="secondary" className="text-sm">
                You
              </Badge>
            )}
            <Badge 
              variant="outline" 
              className={`ml-auto ${getRankBadgeColor(rank)}`}
            >
              Rank #{rank}
            </Badge>
          </div>
          
          {/* Progress Bar */}
          {rank <= 3 && leaders.length > 0 && (
            <div className="flex items-center gap-3">
              <Progress 
                value={(leader.total_streak / (leaders[0]?.total_streak || 1)) * 100} 
                className="h-2 flex-1"
              />
              <div className="flex items-center gap-1 min-w-[80px]">
                <Flame className="w-4 h-4 text-warning" />
                <span className="font-bold">{leader.total_streak || 0}</span>
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Current user stats card
  const CurrentUserStats = () => {
    if (!currentUserData) return null;
    
    // If user has 0 streak, show motivational message
    const hasStreak = currentUserData.total_streak > 0;
    
    return (
      <Card className="bg-gradient-primary/5 border-primary/20 mt-4">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg sm:text-xl">Your Position</h3>
              <p className="text-sm text-muted-foreground">
                {hasStreak ? 'Global ranking' : 'Start building your streak!'}
              </p>
            </div>
            {hasStreak && currentUserRank ? (
              <Badge variant="secondary" className="text-lg sm:text-xl px-3 py-1">
                #{currentUserRank}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-lg sm:text-xl px-3 py-1">
                Not Ranked
              </Badge>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">Total Streak</p>
                <div className="flex items-center gap-2">
                  <Flame className={`w-5 h-5 ${hasStreak ? 'text-warning' : 'text-muted-foreground'}`} />
                  <span className="text-2xl font-bold">{currentUserData.total_streak || 0}</span>
                </div>
              </div>
              
              {hasStreak && currentUserRank && leaders.length > 0 ? (
                <div className="bg-card rounded-lg p-3">
                  <p className="text-sm text-muted-foreground mb-1">Points to Next Rank</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    {currentUserRank > 1 ? (
                      <span className="text-2xl font-bold">
                        {Math.max(0, (leaders[currentUserRank - 2]?.total_streak || 0) - currentUserData.total_streak + 1)}
                      </span>
                    ) : (
                      <span className="text-2xl font-bold">0</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-card rounded-lg p-3">
                  <p className="text-sm text-muted-foreground mb-1">Complete 1 Day</p>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <span className="text-2xl font-bold">1</span>
                  </div>
                </div>
              )}
            </div>
            
            {hasStreak && currentUserRank && currentUserRank > 1 && leaders.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Need {Math.max(0, (leaders[currentUserRank - 2]?.total_streak || 0) - currentUserData.total_streak + 1)} more days to reach rank #{currentUserRank - 1}
                </p>
                <Progress 
                  value={((currentUserData.total_streak || 0) / ((leaders[currentUserRank - 2]?.total_streak || 1))) * 100} 
                  className="h-2"
                />
              </div>
            )}
            
            {!hasStreak && (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">
                  Complete habits for 1 day to appear on the leaderboard!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Loading state
  if (loading) {
    return (
      <Card className="bg-gradient-card border-border shadow-card animate-pulse">
        <CardHeader className="pb-4">
          <LoadingSkeleton />
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <CardTitle className="text-lg sm:text-xl">Leaderboard</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {timeFilter === 'all-time' ? 'All-time top performers' : 
               timeFilter === 'weekly' ? 'This week\'s leaders' : 
               'This month\'s leaders'}
            </CardDescription>
          </div>
          
          {/* Time Filter - Desktop */}
          <div className="hidden sm:block">
            <Select value={timeFilter} onValueChange={(v: TimeFilter) => setTimeFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-time">All Time</SelectItem>
                <SelectItem value="weekly">This Week</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Time Filter - Mobile Tabs */}
        <div className="sm:hidden">
          <Tabs value={timeFilter} onValueChange={(v: TimeFilter) => setTimeFilter(v)} className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="all-time">All</TabsTrigger>
              <TabsTrigger value="weekly">Week</TabsTrigger>
              <TabsTrigger value="monthly">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Top 3 Podium - Desktop */}
        <div className="hidden lg:block mb-6">
          {leaders.length >= 3 ? (
            <div className="grid grid-cols-3 gap-4">
              {leaders.slice(0, 3).map((leader, index) => (
                <div 
                  key={leader.id}
                  className={`rounded-xl p-4 shadow-lg ${
                    index === 0 ? 'bg-gradient-to-b from-yellow-500/20 to-transparent order-2' :
                    index === 1 ? 'bg-gradient-to-b from-gray-500/20 to-transparent order-1 mt-6' :
                    'bg-gradient-to-b from-orange-500/20 to-transparent order-3 mt-6'
                  }`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-3">
                      {getRankIcon(index + 1)}
                    </div>
                    <h3 className="font-bold text-lg mb-1">{leader.username}</h3>
                    <div className="flex items-center gap-1 mb-2">
                      <Flame className="w-4 h-4 text-warning" />
                      <span className="text-2xl font-bold">{leader.total_streak || 0}</span>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      #{index + 1}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Be the first to build a streak!</p>
            </div>
          )}
        </div>
        
        {/* Leaderboard List - Scrollable Container */}
        <div className="space-y-2 sm:space-y-3 max-h-[300px] overflow-y-auto pr-1 sm:pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40 mb-4">
          {leaders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No leaderboard data yet</p>
              <p className="text-sm mt-1">Complete habits for 1 day to appear on the leaderboard!</p>
            </div>
          ) : (
            <>
              {/* Mobile List */}
              <div className="lg:hidden space-y-2">
                {leaders.map((leader, index) => (
                  <MobileLeaderItem key={leader.id} leader={leader} rank={index + 1} />
                ))}
              </div>
              
              {/* Desktop List */}
              <div className="hidden lg:block space-y-3">
                {leaders.map((leader, index) => (
                  <DesktopLeaderItem key={leader.id} leader={leader} rank={index + 1} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Current User Stats - Always show if user is logged in */}
        {currentUserData && <CurrentUserStats />}
        
        {/* Legend */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Trophy className="w-2 h-2 text-yellow-600" />
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
            <div className="flex items-center gap-2">
              <Flame className="w-3 h-3 text-warning" />
              <span>Total Streak Days</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};