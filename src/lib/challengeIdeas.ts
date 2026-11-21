// Ready-made challenges the coach can start in one tap. Every one is a running total (reps, minutes, steps or days)
// that clients log a little at a time, so a total of 100 press-ups can be done as 10 sets of 10.
export interface ChallengeIdea { name: string; description: string; unit: string; goal: number; days: number; level: 'Easy' | 'Medium' | 'Hard' }

export const CHALLENGE_IDEAS: ChallengeIdea[] = [
  { name: 'The Hundred Club', description: 'Bank 100 press-ups in a week. Do them in sets of 5, 10 or whatever you can manage. Knees count, form does not get skipped.', unit: 'press-ups', goal: 100, days: 7, level: 'Easy' },
  { name: 'Press-up Staircase', description: '500 press-ups in two weeks. Try a staircase: 1, 2, 3 up to 10, then back down. That is 100 in one go.', unit: 'press-ups', goal: 500, days: 14, level: 'Medium' },
  { name: 'Four Digits', description: '1,000 press-ups in 30 days. About 33 a day, or 50 on four days a week. Chest, triceps and a lot of pride.', unit: 'press-ups', goal: 1000, days: 30, level: 'Hard' },
  { name: 'Squat Stack', description: '300 bodyweight squats in a week. Brush your teeth, do 10. Wait for the kettle, do 15. They add up quickly.', unit: 'squats', goal: 300, days: 7, level: 'Easy' },
  { name: 'Leg Day Landslide', description: '1,000 squats in two weeks. Spread them out or chase a big set. Full depth only, heels down.', unit: 'squats', goal: 1000, days: 14, level: 'Hard' },
  { name: 'Plank Bank', description: 'Collect 20 minutes of plank over two weeks. Sixty seconds counts, thirty seconds counts, log the minutes.', unit: 'minutes', goal: 20, days: 14, level: 'Medium' },
  { name: 'Wall Sit Wars', description: '15 minutes of wall sit across two weeks. Back flat, thighs level, and no leaning on your hands.', unit: 'minutes', goal: 15, days: 14, level: 'Medium' },
  { name: 'Stair Hunter', description: 'Climb 1,000 stairs in a week. Skip the lift, take the long way up, and count every step.', unit: 'stairs', goal: 1000, days: 7, level: 'Medium' },
  { name: 'Burpee Bounty', description: '150 burpees in two weeks. Ten a day gets you there. Nobody enjoys these, which is the point.', unit: 'burpees', goal: 150, days: 14, level: 'Hard' },
  { name: 'Skip Sprint', description: '2,000 skips in a week. Rope or no rope, count each jump. Short bursts beat one long grind.', unit: 'skips', goal: 2000, days: 7, level: 'Medium' },
  { name: 'Dead Hang Debt', description: 'Hang from a bar for 10 minutes in total over two weeks. Your grip will tell you how it went.', unit: 'minutes', goal: 10, days: 14, level: 'Hard' },
  { name: 'Lunge Lottery', description: '300 walking lunges (150 each leg counts as 300) in two weeks. Long strides, upright chest.', unit: 'lunges', goal: 300, days: 14, level: 'Medium' },
  { name: 'Glute Bridge Grind', description: '400 glute bridges in two weeks. Pause for a second at the top of each one. Single-leg counts double.', unit: 'bridges', goal: 400, days: 14, level: 'Easy' },
  { name: 'Ten Minute Mornings', description: 'Move for 10 minutes before breakfast on 14 mornings. Walk, stretch, lift, anything. Log one for each morning done.', unit: 'mornings', goal: 14, days: 14, level: 'Easy' },
  { name: 'Step Stack', description: '150,000 steps in two weeks. That is about 10,700 a day. Walk the phone calls and take the long route home.', unit: 'steps', goal: 150000, days: 14, level: 'Medium' },
  { name: 'Sunday Long Walk', description: 'Four weekends, four proper walks of 45 minutes or more. Log one each time you finish.', unit: 'walks', goal: 4, days: 28, level: 'Easy' },
]
