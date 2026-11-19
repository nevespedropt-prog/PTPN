import { searchExercises, equipmentGroups, machineKinds, groupByMuscle, similarExercises } from '../src/lib/exerciseSearch.ts'

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

  // v37: equipment tiles, grouped curls, similar names
  const eq = e => equipmentGroups(e).join()
  ok(eq('Bodyweight') === 'No equipment' && eq('Dumbbells') === 'Dumbbells' && eq('Dumbbell') === 'Dumbbells' && eq('Band') === 'Resistance bands' && eq('TRX') === 'TRX', 'equipment: the simple labels land under the right tile')
  ok(eq('Machine') === 'Machines' && eq('Cable') === 'Machines' && eq('Smith machine') === 'Machines', 'equipment: machines, cables and Smith machine all sit under Machines')
  ok(eq('Barbell') === 'Barbells' && eq('EZ bar') === 'Barbells' && eq('Trap bar') === 'Barbells' && eq('Swiss ball') === 'Other' && eq('Sled') === 'Other', 'equipment: barbells together, odd kit under Other')
  ok(eq('Band or cable') === 'Resistance bands,Machines' && eq('Smith machine or dumbbells') === 'Machines,Dumbbells', 'equipment: a mixed label shows under each tile it names')
  ok(machineKinds('Machine').join() === 'Machine' && machineKinds('Cable').join() === 'Cable' && machineKinds('Smith machine').join() === 'Smith' && machineKinds('Dumbbells').length === 0, 'equipment: Machines splits into gym machines, cables and Smith')
  const curls = groupByMuscle(searchExercises(LIB, 'curl'))
  ok(curls.map(g => g.muscle).join() === 'Biceps,Forearms,Hamstrings' && curls[0].rows.length === 3, 'curls: typing curl groups the results by the muscle they train, biggest group first')
  ok(names('leg curl').join() === 'Lying leg curl', 'search: "leg curl" finds the hamstring curl machine')
  const LIB2 = [...LIB, ex('Pec deck', 'Chest', 'Machine'), ex('Lat pulldown machine', 'Back', 'Machine'), ex('Hip abduction machine', 'Glutes', 'Machine')]
  const near = q => similarExercises(LIB2, q).map(r => r.name)
  ok(searchExercises(LIB2, 'butterfly machine').map(r => r.name).join() === 'Pec deck' && searchExercises(LIB2, 'pec fly').map(r => r.name).join() === 'Pec deck', 'search: other names for a machine (butterfly, pec fly) find the standard one')
  ok(near('bicpe curl').includes('Hammer bicep curl') && near('pec dek')[0] === 'Pec deck' && near('hip abductin')[0] === 'Hip abduction machine', 'did you mean: typos suggest the closest exercises')
  ok(near('zzzz').length === 0 && near('').length === 0, 'did you mean: nothing close means no suggestions')
}
