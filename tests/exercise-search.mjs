import { searchExercises } from '../src/lib/exerciseSearch.ts'

const ex = (name, muscle, equipment = 'Dumbbells', category = 'strength') => ({ name, muscle, equipment, category })
const LIB = [
  ex('Barbell bicep curl', 'Biceps', 'Barbell'), ex('Hammer bicep curl', 'Biceps'), ex('Chin-up hold', 'Biceps', 'Bodyweight'),
  ex('Lying leg curl', 'Hamstrings', 'Machine'), ex('Dumbbell wrist curl', 'Forearms'), ex('Cable bicep curl', 'Biceps', 'Cable'),
  ex('Standing calf raise', 'Calves', 'Machine'), ex('Plank', 'Core', 'Bodyweight', 'core'), ex('Cable fly', 'Chest', 'Cable'),
  ex('Dumbbell fly', 'Chest'), ex('Rear delt fly', 'Shoulders'), ex('Lat pulldown', 'Back', 'Cable'), ex('Triceps pushdown', 'Triceps', 'Cable'),
]
const names = q => searchExercises(LIB, q).map(r => r.name)

export function exerciseSearchChecks(ok) {
  ok(names('bicep').length === 4 && names('bicep').every(n => /bicep|Chin-up hold/.test(n)), 'search: "bicep" lists every biceps exercise, not just names containing it')
  ok(names('bicep')[0] !== 'Lying leg curl' && !names('bicep').includes('Lying leg curl') && !names('bicep').includes('Dumbbell wrist curl'), 'search: other curls (leg, wrist) are not biceps')
  ok(names('bicep cable').join() === 'Cable bicep curl', 'search: more words narrow the list (muscle plus equipment)')
  ok(names('bicep curl').length === 3 && !names('bicep curl').includes('Chin-up hold'), 'search: muscle plus name narrows to the biceps curls')
  ok(names('curl').length === 5, 'search: "curl" alone finds every curl, whatever muscle')
  ok(names('calf').join() === 'Standing calf raise' && names('abs').join() === 'Plank' && names('lats').join() === 'Lat pulldown', 'search: everyday words (calf, abs, lats) find their muscle')
  ok(names('fly').length === 3, 'search: every kind of fly shows (chest, cable, rear delt)')
  ok(names('triceps')[0] === 'Triceps pushdown' && names('').length === LIB.length, 'search: an empty search keeps the whole list')
  ok(searchExercises(LIB, 'chest')[0].muscle === 'Chest', 'search: exercises for the typed muscle come first')
}
