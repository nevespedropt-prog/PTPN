import type { Recipe } from '../types'
import { forServings } from '../lib/nutrition'
import { MacroChips } from './ui'
import RecipeArt from './RecipeArt'

/** Photo, macros, ingredients and method for one recipe at a given number of servings. */
export default function RecipeView({ recipe, servings = 1 }: { recipe: Recipe; servings?: number }) {
  return (
    <div className="stack">
      {recipe.image_url && <RecipeArt name={recipe.name} url={recipe.image_url} tall />}
      <p className="mute" style={{ margin: 0 }}>{recipe.description}</p>
      <MacroChips m={forServings(recipe, servings)} />
      {recipe.prep_min && <p className="mute small" style={{ margin: 0 }}>{recipe.prep_min} min · {servings} serving{servings === 1 ? '' : 's'}</p>}
      <h3>Ingredients{servings !== 1 && <span className="mute small" style={{ fontWeight: 500 }}> (for 1 serving, you eat {servings})</span>}</h3>
      <ul className="ingredients">{recipe.ingredients.map((x, i) => <li key={i}>{x}</li>)}</ul>
      <h3>Method</h3>
      <ol className="steps">{recipe.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
    </div>
  )
}
