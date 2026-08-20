import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import {
  DEFAULT_RECIPE_CATEGORY,
  Recipe,
  RecipeDocument,
} from './schemas/recipe.schema';
import { Counter, CounterDocument } from './schemas/counter.schema';

const RECIPE_COUNTER_NAME = 'recipeId';
const DEFAULT_IMG_URL =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600';

// Dữ liệu mẫu — chỉ chèn vào MongoDB một lần nếu collection đang rỗng (xem onModuleInit).
const SEED_RECIPES: Recipe[] = [
  {
    id: 1,
    name: 'Spaghetti Carbonara',
    imgUrl:
      'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600',
    description: 'Món mì Ý truyền thống với trứng và thịt xông khói.',
    authorEmail: 'author@example.com',
    price: 189000,
    isFavorite: false,
    category: 'Món chính',
    ingredients: [
      { name: 'Mì Spaghetti', quantity: 200, unit: 'g' },
      { name: 'Thịt má heo Guanciale', quantity: 100, unit: 'g' },
      { name: 'Lòng đỏ trứng', quantity: 4, unit: 'cái' },
      { name: 'Phô mai Pecorino Romano', quantity: 50, unit: 'g' },
      { name: 'Tiêu đen', quantity: 1, unit: 'thìa cà phê' },
    ],
  },
  {
    id: 2,
    name: 'Salad Caprese',
    imgUrl:
      'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=600',
    description: 'Món salad Ý đơn giản và thanh mát.',
    authorEmail: 'author@example.com',
    price: 129000,
    isFavorite: true,
    category: 'Súp & Salad',
    ingredients: [
      { name: 'Cà chua', quantity: 4, unit: 'quả' },
      { name: 'Phô mai Mozzarella tươi', quantity: 200, unit: 'g' },
      { name: 'Lá húng quế tươi', quantity: 1, unit: 'nắm' },
      { name: 'Dầu ô liu nguyên chất', quantity: 2, unit: 'thìa canh' },
    ],
  },
  {
    id: 3,
    name: 'Bò kho bánh mì',
    imgUrl:
      'https://cdn.tgdd.vn/2022/09/CookDishThumb/uu-nhuoc-diem-nau-bo-kho-bang-noi-noi-ap-suat-va-noi-com-dien-thumb-620x620.jpg?w=600',
    description: 'Nước sốt đậm vị, bò dai dai, beo béo, thơm nồng mùi.',
    authorEmail: 'author@example.com',
    price: 65000,
    isFavorite: true,
    category: 'Món chính',
    ingredients: [
      { name: 'Bò', quantity: 100, unit: 'g' },
      { name: 'Bánh mì', quantity: 2, unit: 'ổ' },
      { name: 'Cà rốt', quantity: 10, unit: 'miếng' },
      { name: 'Hành tây', quantity: 2, unit: 'củ' },
      { name: 'Rau ăn kèm', quantity: 100, unit: 'g' },
      { name: 'Tương chấm', quantity: 1, unit: 'chén' },
    ],
  },
  {
    id: 4,
    name: 'Bánh tráng trộn',
    imgUrl:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMarJNGet-IWpRQCCW83Qymyag5Y4UEIixUA&s?w=600',
    description: 'Món bánh tráng trộn với nhiều nguyên liệu hấp dẫn.',
    authorEmail: 'author@example.com',
    price: 35000,
    isFavorite: false,
    category: 'Khai vị',
    ingredients: [
      { name: 'Bánh tráng', quantity: 1, unit: 'tấm' },
      { name: 'Rau răm', quantity: 1, unit: 'bó' },
      { name: 'Trứng cút', quantity: 10, unit: 'cái' },
      { name: 'Muối tôm', quantity: 50, unit: 'g' },
      { name: 'Đậu phộng', quantity: 50, unit: 'g' },
      { name: 'Bò khô', quantity: 50, unit: 'g' },
    ],
  },
  {
    id: 5,
    name: 'Canh khổ qua nhồi thịt',
    imgUrl:
      'https://cdn.tgdd.vn/Files/2018/01/28/1062511/cach-nau-canh-kho-qua-nhoi-thit-khong-dang-ngon-thanh-mat-202312281937054535.jpg?w=600',
    description: 'Món canh khổ qua nhồi thịt hấp dẫn.',
    authorEmail: 'author@example.com',
    price: 79000,
    isFavorite: false,
    category: 'Súp & Salad',
    ingredients: [
      { name: 'Khổ qua', quantity: 4, unit: 'quả' },
      { name: 'Thịt heo', quantity: 1, unit: 'kg' },
      { name: 'Trứng cút', quantity: 10, unit: 'quả' },
      { name: 'Hành tím', quantity: 50, unit: 'g' },
      { name: 'Nấm mèo', quantity: 50, unit: 'g' },
      { name: 'Hành lá', quantity: 50, unit: 'g' },
    ],
  },
];

@Injectable()
export class RecipesService implements OnModuleInit {
  constructor(
    @InjectModel(Recipe.name)
    private readonly recipeModel: Model<RecipeDocument>,
    @InjectModel(Counter.name)
    private readonly counterModel: Model<CounterDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.recipeModel.countDocuments();
    if (count > 0) {
      return;
    }
    await this.recipeModel.insertMany(SEED_RECIPES);
    await this.counterModel.findOneAndUpdate(
      { name: RECIPE_COUNTER_NAME },
      { $set: { value: SEED_RECIPES.length } },
      { upsert: true },
    );
  }

  // .lean() không tự áp default khai báo trong schema cho các document đã có sẵn trong DB từ
  // trước khi thêm field "category" — phải tự gán mặc định khi đọc để tránh trả về undefined.
  private withCategoryDefault(recipe: Recipe): Recipe {
    return { ...recipe, category: recipe.category ?? DEFAULT_RECIPE_CATEGORY };
  }

  async findAll(keyword?: string): Promise<Recipe[]> {
    const filter = keyword?.trim()
      ? { name: { $regex: keyword.trim(), $options: 'i' } }
      : {};
    const recipes = await this.recipeModel
      .find(filter, { _id: 0, __v: 0 })
      .lean();
    return recipes.map((recipe) => this.withCategoryDefault(recipe));
  }

  async findOne(id: number): Promise<Recipe> {
    const recipe = await this.recipeModel
      .findOne({ id }, { _id: 0, __v: 0 })
      .lean();
    if (!recipe) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    return this.withCategoryDefault(recipe);
  }

  async create(dto: CreateRecipeDto): Promise<Recipe> {
    const id = await this.nextId();
    const created = await this.recipeModel.create({
      id,
      name: dto.name.trim(),
      description: dto.description.trim(),
      ingredients: dto.ingredients ?? [],
      category: dto.category ?? DEFAULT_RECIPE_CATEGORY,
      imgUrl: dto.imgUrl?.trim() || DEFAULT_IMG_URL,
      price: dto.price ?? 0,
      isFavorite: dto.isFavorite ?? false,
      authorEmail: dto.authorEmail.trim(),
    });
    return this.findOne(created.id);
  }

  async update(id: number, dto: UpdateRecipeDto): Promise<Recipe> {
    const updated = await this.recipeModel
      .findOneAndUpdate(
        { id },
        {
          $set: {
            ...dto,
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.description !== undefined
              ? { description: dto.description.trim() }
              : {}),
            ...(dto.authorEmail !== undefined
              ? { authorEmail: dto.authorEmail.trim() }
              : {}),
          },
        },
        { new: true, projection: { _id: 0, __v: 0 } },
      )
      .lean();
    if (!updated) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
    return this.withCategoryDefault(updated);
  }

  async remove(id: number): Promise<void> {
    const result = await this.recipeModel.deleteOne({ id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Không tìm thấy công thức #${id}`);
    }
  }

  private async nextId(): Promise<number> {
    const counter = await this.counterModel.findOneAndUpdate(
      { name: RECIPE_COUNTER_NAME },
      { $inc: { value: 1 } },
      { new: true, upsert: true },
    );
    return counter.value;
  }
}
