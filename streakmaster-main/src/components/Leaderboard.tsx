import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeaderboardProps {
  currentUserId?: string;
  refreshTrigger?: number;
}

type TimeFilter = 'all-time' | 'weekly' | 'monthly';

export const Leaderboard = ({ currentUserId, refreshTrigger }: LeaderboardProps) => {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all-time');

  const fetchLeaderboard = async () => {
    // For now, we'll implement all-time leaderboard
    // Weekly and monthly would require additional tracking in the database
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('total_streak', { ascending: false })
      .limit(10);

    if (profiles) {
      setLeaders(profiles);
      
      const userIndex = profiles.findIndex(p => p.id === currentUserId);
      if (userIndex !== -1) {
        setCurrentUserRank(userIndex + 1);
      } else if (currentUserId) {
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id')
          .order('total_streak', { ascending: false });
        
        const rank = allProfiles?.findIndex(p => p.id === currentUserId);
        if (rank !== undefined && rank !== -1) {
          setCurrentUserRank(rank + 1);
        }
      }
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
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-warning" />;
      case 2:
        return <Medal className="w-5 h-5 text-muted-foreground" />;
      case 3:
        return <Award className="w-5 h-5 text-orange-500" />;
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Top Streakers</CardTitle>
          {currentUserRank && (
            <Badge variant="secondary">
              Your rank: #{currentUserRank}
            </Badge>
          )}
        </div>
        <Select value={timeFilter} onValueChange={(v: TimeFilter) => setTimeFilter(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-time">All Time</SelectItem>
            <SelectItem value="weekly">This Week</SelectItem>
            <SelectItem value="monthly">This Month</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40">
          {leaders.map((leader, index) => (
            <div
              key={leader.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                leader.id === currentUserId 
                  ? 'bg-primary/10 border border-primary/20' 
                  : 'bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-center w-8">
                {getRankIcon(index + 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">
                    {leader.username}
                  </span>
                  {leader.id === currentUserId && (
                    <Badge variant="outline" className="text-xs">You</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold">{leader.total_streak}</span>
                <span className="text-xs text-muted-foreground">streak</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};