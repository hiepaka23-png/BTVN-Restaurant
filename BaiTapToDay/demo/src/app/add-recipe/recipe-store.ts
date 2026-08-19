import { computed, inject } from '@angular/core';
import { signalStore, withComputed, withMethods, withProps } from '@ngrx/signals';
import { RecipeModel } from '../models';
import { RecipeService } from '../recipe-service';

export const RecipeStore = signalStore(
    { providedIn: 'root' },

    // Toàn bộ dữ liệu công thức (kể cả tìm kiếm) đến từ RecipeService, gọi backend NestJS.
    withProps(() => ({
        recipeService: inject(RecipeService),
    })),

    withComputed((store) => ({
        recipes: computed(() => store.recipeService.recipes()),
        keyword: computed(() => store.recipeService.keyword()),
        isLoading: computed(() => store.recipeService.isLoading()),
    })),

    // Nơi DUY NHẤT được đổi state cục bộ — CRUD và tìm kiếm thật được ủy quyền cho RecipeService.
    withMethods((store) => ({
        setKeyword(keyword: string): void {
            store.recipeService.keyword.set(keyword);
        },

        addRecipe(newRecipe: Omit<RecipeModel, 'id'>): Promise<RecipeModel> {
            return store.recipeService.addRecipe(newRecipe);
        },

        updateRecipe(id: number, changes: Partial<Omit<RecipeModel, 'id'>>): Promise<RecipeModel> {
            return store.recipeService.updateRecipe(id, changes);
        },

        deleteRecipe(id: number): Promise<void> {
            return store.recipeService.deleteRecipe(id);
        },

        getRecipeById(id: number): Promise<RecipeModel | undefined> {
            return store.recipeService.getRecipeById(id);
        },
    })),
);
