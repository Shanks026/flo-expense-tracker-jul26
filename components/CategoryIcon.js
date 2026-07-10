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

export function getCategoryIconComponent(iconKey) {
  return ICONS[iconKey] ?? Wallet;
}

export default function CategoryIcon({ icon, size = 20, color, strokeWidth = 2 }) {
  const IconComponent = getCategoryIconComponent(icon);
  return <IconComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
