import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Danh mục món ăn thật (khác với cờ isFavorite — dùng để đánh dấu món "Đặc biệt" nổi bật, không
// phải một danh mục). Đồng bộ tay với RECIPE_CATEGORIES ở frontend (models.ts).
export const RECIPE_CATEGORIES = [
  'Món chính',
  'Khai vị',
  'Súp & Salad',
  'Đồ uống',
  'Tráng miệng',
] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];
export const DEFAULT_RECIPE_CATEGORY: RecipeCategory = 'Món chính';

@Schema({ _id: false })
export class Ingredient {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  quantity: number;

  @Prop({ required: true })
  unit: string;
}
export const IngredientSchema = SchemaFactory.createForClass(Ingredient);

@Schema({ timestamps: true })
export class Recipe {
  // Id số nguyên, tự tăng qua CounterService — giữ tương thích với route /recipes/:id ở frontend.
  @Prop({ required: true, unique: true, index: true })
  id: number;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [IngredientSchema], default: [] })
  ingredients: Ingredient[];

  @Prop({ default: '' })
  imgUrl: string;

  @Prop({ default: 0 })
  price: number;

  @Prop({ default: false })
  isFavorite: boolean;

  @Prop({ enum: RECIPE_CATEGORIES, default: DEFAULT_RECIPE_CATEGORY })
  category: RecipeCategory;

  @Prop({ required: true })
  authorEmail: string;
}

export type RecipeDocument = HydratedDocument<Recipe>;
export const RecipeSchema = SchemaFactory.createForClass(Recipe);
