import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Habit {
  id: string;
  user_id: string;
  frequency: 'daily' | 'weekly' | 'weekdays';
  weekdays: number[] | null;
  start_date: string;
  habit_logs: HabitLog[];
}

interface HabitLog {
  log_date: string;
  status: 'done' | 'skipped' | 'missed' | 'pending';
}

function calculateStreak(habit: Habit): number {
  const logs = habit.habit_logs.sort((a, b) => 
    new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the first scheduled date to check
  let checkDate = new Date(today);
  
  for (const log of logs) {
    const logDate = new Date(log.log_date);
    logDate.setHours(0, 0, 0, 0);

    // Skip if this date isn't scheduled for this habit
    if (habit.frequency === 'weekdays' && habit.weekdays) {
      const dayOfWeek = logDate.getDay();
      if (!habit.weekdays.includes(dayOfWeek)) {
        continue;
      }
    }

    // If status is 'done', increment streak
    if (log.status === 'done') {
      streak++;
      checkDate = logDate;
    } else if (log.status === 'missed') {
      // Streak is broken
      break;
    }
    // 'skipped' doesn't break the streak, just continue
  }

  return streak;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all habits with their logs
    const { data: habits, error: habitsError } = await supabaseClient
      .from('habits')
      .select(`
        id,
        user_id,
        frequency,
        weekdays,
        start_date,
        habit_logs(log_date, status)
      `);

    if (habitsError) throw habitsError;

    // Calculate streak for each habit
    const habitUpdates = habits?.map(habit => ({
      id: habit.id,
      current_streak: calculateStreak(habit as any)
    })) || [];

    // Update all habit streaks
    for (const update of habitUpdates) {
      await supabaseClient
        .from('habits')
        .update({ current_streak: update.current_streak })
        .eq('id', update.id);
    }

    // Calculate total streak per user
    const userStreaks = habits?.reduce((acc: Record<string, number>, habit: any) => {
      const userId = habit.user_id;
      const streak = calculateStreak(habit);
      acc[userId] = (acc[userId] || 0) + streak;
      return acc;
    }, {}) || {};

    // Update profile total streaks
    for (const [userId, totalStreak] of Object.entries(userStreaks)) {
      await supabaseClient
        .from('profiles')
        .update({ total_streak: totalStreak })
        .eq('id', userId);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        updated: habitUpdates.length,
        userStreaks: Object.keys(userStreaks).length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error updating streaks:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
