import { Component, computed, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../recipe-service';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { RecipeModel } from '../models';
import { RecipeStore } from '../add-recipe/recipe-store';
@Component({
  selector: 'app-recipe-list',
  imports: [FormsModule, RouterLink, MatIconModule, MatFormFieldModule, MatInputModule, MatListModule, MatButtonModule],
  templateUrl: './recipe-list.html',
  styleUrl: './recipe-list.css',
})
export class RecipeList {
  private readonly recipeService = inject(RecipeService);
  protected readonly recipes = this.recipeService.recipes;
  protected readonly selectedRecipe = signal<RecipeModel | undefined>(undefined);
  // protected filteredRecipe = computed(() => {
  //   const key = this.keyword().trim().toLowerCase();
  //   const all = this.recipeService.recipes();
  //   if (!key) {
  //     return all;
  //   }
  //   return all.filter((recipe) =>
  //     recipe.name.toLowerCase().includes(key)
  //   );
  // });
  protected readonly store = inject(RecipeStore);
  protected chooseRecipe(recipe: RecipeModel): void {
    this.selectedRecipe.set(recipe);
  }

  protected formatPrice(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }



}



