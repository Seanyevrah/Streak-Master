import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface WeeklyStreakChartProps {
  userId?: string;
  refreshTrigger?: number;
}

export const WeeklyStreakChart = ({ userId, refreshTrigger }: WeeklyStreakChartProps) => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [averageCompletion, setAverageCompletion] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'neutral'>('neutral');

  const fetchData = async () => {
    if (!userId) return;
    
    setLoading(true);
    
    try {
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
          dayShort: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
          completed: totalCompleted,
          scheduled: totalScheduled,
          percentage
        });
      }

      setChartData(last7Days);
      
      // Calculate average completion
      const percentages = last7Days.map(d => d.percentage).filter(p => p > 0);
      const avg = percentages.length > 0 
        ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
        : 0;
      setAverageCompletion(avg);
      
      // Calculate trend
      if (last7Days.length >= 2) {
        const todayPercent = last7Days[last7Days.length - 1].percentage;
        const yesterdayPercent = last7Days[last7Days.length - 2].percentage;
        if (todayPercent > yesterdayPercent) setTrend('up');
        else if (todayPercent < yesterdayPercent) setTrend('down');
        else setTrend('neutral');
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId, refreshTrigger]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm sm:text-base">{data.day}</p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {data.completed} of {data.scheduled} habits
          </p>
          <p className="text-sm sm:text-base font-bold text-primary">
            {data.percentage}% completion
          </p>
        </div>
      );
    }
    return null;
  };

  // Loading Skeletons
  const LoadingSkeleton = () => (
    <>
      {/* Header Loading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 animate-pulse">
        <div className="space-y-2">
          <div className="h-6 bg-muted rounded w-40"></div>
          <div className="h-4 bg-muted rounded w-32"></div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-muted rounded-lg"></div>
          <div>
            <div className="h-3 bg-muted rounded w-16 mb-1"></div>
            <div className="h-5 bg-muted rounded w-12"></div>
          </div>
        </div>
      </div>

      {/* Mobile View Loading */}
      <div className="sm:hidden space-y-4 animate-pulse">
        {/* Today's summary loading */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-card rounded-lg">
            <div className="h-3 bg-muted rounded w-12 mb-2"></div>
            <div className="flex items-baseline gap-2">
              <div className="h-8 bg-muted rounded w-16"></div>
              <div className="h-4 bg-muted rounded w-8"></div>
            </div>
            <div className="h-3 bg-muted rounded w-24 mt-3"></div>
          </div>
          
          <div className="p-4 bg-card rounded-lg">
            <div className="h-3 bg-muted rounded w-16 mb-2"></div>
            <div className="h-8 bg-muted rounded w-12"></div>
            <div className="flex items-center gap-1 mt-3">
              <div className="flex-1 h-2 bg-muted rounded-full"></div>
              <div className="h-3 bg-muted rounded w-8"></div>
            </div>
          </div>
        </div>
        
        {/* Mini bar chart loading */}
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-24"></div>
          <div className="flex items-end justify-between h-24">
            {[1, 2, 3, 4, 5, 6, 7].map((item) => (
              <div key={item} className="flex flex-col items-center w-8">
                <div className="h-3 bg-muted rounded w-6 mb-1"></div>
                <div className="relative w-4 flex flex-col justify-end h-20">
                  <div 
                    className="w-full rounded-t-md bg-muted"
                    style={{ height: `${Math.random() * 100}%` }}
                  />
                  <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2">
                    <div className="h-3 bg-muted rounded w-6"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop/Tablet View Loading */}
      <div className="hidden sm:block animate-pulse">
        <div className="h-48 lg:h-56 bg-muted/30 rounded-lg">
          {/* Chart grid lines */}
          <div className="h-full flex flex-col justify-between p-4">
            <div className="h-4 bg-muted/50 rounded w-full"></div>
            <div className="h-4 bg-muted/50 rounded w-full"></div>
            <div className="h-4 bg-muted/50 rounded w-full"></div>
            <div className="h-4 bg-muted/50 rounded w-full"></div>
          </div>
          {/* X-axis labels */}
          <div className="flex justify-between px-4 mt-2">
            {[1, 2, 3, 4, 5, 6, 7].map((item) => (
              <div key={item} className="h-3 bg-muted rounded w-8"></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Legend Loading */}
      <div className="mt-4 pt-4 border-t animate-pulse">
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted rounded"></div>
              <div className="h-3 bg-muted rounded w-12"></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  // Mobile simplified view
  const MobileSummary = () => {
    const today = chartData[chartData.length - 1];
    const yesterday = chartData[chartData.length - 2];
    
    return (
      <div className="sm:hidden space-y-4">
        {loading ? (
          <div className="animate-pulse">
            {/* Today's summary loading */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-card rounded-lg">
                <div className="h-3 bg-muted rounded w-12 mb-2"></div>
                <div className="flex items-baseline gap-2">
                  <div className="h-8 bg-muted rounded w-16"></div>
                  <div className="h-4 bg-muted rounded w-8"></div>
                </div>
                <div className="h-3 bg-muted rounded w-24 mt-3"></div>
              </div>
              
              <div className="p-4 bg-card rounded-lg">
                <div className="h-3 bg-muted rounded w-16 mb-2"></div>
                <div className="h-8 bg-muted rounded w-12"></div>
                <div className="flex items-center gap-1 mt-3">
                  <div className="flex-1 h-2 bg-muted rounded-full"></div>
                  <div className="h-3 bg-muted rounded w-8"></div>
                </div>
              </div>
            </div>
            
            {/* Mini bar chart loading */}
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="flex items-end justify-between h-24">
                {[1, 2, 3, 4, 5, 6, 7].map((item) => (
                  <div key={item} className="flex flex-col items-center w-8">
                    <div className="h-3 bg-muted rounded w-6 mb-1"></div>
                    <div className="relative w-4 flex flex-col justify-end h-20">
                      <div 
                        className="w-full rounded-t-md bg-muted"
                        style={{ height: `${Math.random() * 100}%` }}
                      />
                      <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2">
                        <div className="h-3 bg-muted rounded w-6"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
            <Minus className="w-8 h-8 mb-2 opacity-50" />
            <p>No data available</p>
          </div>
        ) : (
          <>
            {/* Today's summary */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Today</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{today?.percentage || 0}%</span>
                  {today && yesterday && today.percentage !== yesterday.percentage && (
                    <span className={`text-xs flex items-center ${today.percentage > yesterday.percentage ? 'text-green-600' : 'text-red-600'}`}>
                      {today.percentage > yesterday.percentage ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(today.percentage - yesterday.percentage)}%
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {today?.completed || 0}/{today?.scheduled || 0} habits
                </p>
              </Card>
              
              <Card className="p-4">
                <p className="text-xs text-muted-foreground mb-1">7-Day Avg</p>
                <div className="text-2xl font-bold">{averageCompletion}%</div>
                <div className="flex items-center gap-1 mt-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-primary rounded-full" 
                      style={{ width: `${averageCompletion}%` }}
                    />
                  </div>
                  <span className="text-xs">{averageCompletion}%</span>
                </div>
              </Card>
            </div>
            
            {/* Mini bar chart */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Daily Progress</p>
              <div className="flex items-end justify-between h-24">
                {chartData.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center w-8">
                    <div className="text-xs text-muted-foreground mb-1">
                      {day.dayShort}
                    </div>
                    <div className="relative w-4 flex flex-col justify-end h-20">
                      <div 
                        className={`w-full rounded-t-md ${
                          day.percentage === 100 ? 'bg-green-500' :
                          day.percentage >= 50 ? 'bg-warning' :
                          'bg-destructive'
                        }`}
                        style={{ height: `${day.percentage}%` }}
                      />
                      <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs">
                        {day.percentage}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg sm:text-xl">Weekly Completion</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Daily habit completion rate
            </CardDescription>
          </div>
          {!loading && chartData.length > 0 && (
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${
                trend === 'up' ? 'bg-green-500/20 text-green-700' :
                trend === 'down' ? 'bg-red-500/20 text-red-700' :
                'bg-muted text-muted-foreground'
              }`}>
                {trend === 'up' && <TrendingUp className="w-4 h-4" />}
                {trend === 'down' && <TrendingDown className="w-4 h-4" />}
                {trend === 'neutral' && <Minus className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average</p>
                <p className="text-lg font-bold">{averageCompletion}%</p>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading State */}
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Mobile View */}
            <MobileSummary />
            
            {/* Desktop/Tablet View */}
            <div className="hidden sm:block">
              {chartData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                  <Minus className="w-12 h-12 mb-4 opacity-50" />
                  <p>No habit data available</p>
                  <p className="text-sm mt-1">Create habits to see your progress chart</p>
                </div>
              ) : (
                <div className="h-48 lg:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={chartData}
                      margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="hsl(var(--border))" 
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="day" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip 
                        content={<CustomTooltip />}
                        cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                      />
                      <Bar 
                        dataKey="percentage" 
                        radius={[6, 6, 0, 0]}
                        barSize={40}
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.percentage === 100 ? 'hsl(var(--success))' : 
                              entry.percentage >= 75 ? 'hsl(var(--primary))' :
                              entry.percentage >= 50 ? 'hsl(var(--warning))' : 
                              'hsl(var(--destructive))'
                            }
                            className="transition-all duration-300 hover:opacity-80"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            
            {/* Legend */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-success"></div>
                  <span>100%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-primary"></div>
                  <span>75-99%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-warning"></div>
                  <span>50-74%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-destructive"></div>
                  <span>Below 50%</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};