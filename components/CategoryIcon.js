import {
  Utensils,
  Plane,
  ShoppingBag,
  Receipt,
  Coffee,
  ShoppingCart,
  Banknote,
  Briefcase,
  MoreHorizontal,
  Wallet,
  Home,
  Car,
  Gift,
  Film,
  HeartPulse,
  GraduationCap,
  Smartphone,
  Dumbbell,
  PiggyBank,
} from 'lucide-react-native';

const ICONS = {
  food: Utensils,
  travel: Plane,
  shopping: ShoppingBag,
  bills: Receipt,
  coffee: Coffee,
  groceries: ShoppingCart,
  salary: Banknote,
  freelance: Briefcase,
  other: MoreHorizontal,
  home: Home,
  car: Car,
  gift: Gift,
  entertainment: Film,
  health: HeartPulse,
  education: GraduationCap,
  phone: Smartphone,
  fitness: Dumbbell,
  savings: PiggyBank,
};

export const CATEGORY_ICON_KEYS = Object.keys(ICONS);

export const CATEGORY_COLORS = [
  '#BBDC12', // lime (brand)
  '#4C7031', // forest
  '#E8A317', // amber
  '#E8785A', // coral
  '#2F8F82', // teal
  '#8A5FBF', // plum
  '#5B6B8C', // slate
  '#D9738F', // rose
  '#B98A2E', // ochre
  '#3A3A3A', // charcoal
  '#3B6FA0', // blue
  '#B5443D', // red
  '#3D4F7D', // navy
  '#D4B106', // gold
];

export function getCategoryIconComponent(iconKey) {
  return ICONS[iconKey] ?? Wallet;
}

export default function CategoryIcon({ icon, size = 20, color, strokeWidth = 2 }) {
  const IconComponent = getCategoryIconComponent(icon);
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
