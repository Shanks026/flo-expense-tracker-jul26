import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import IconButton from './IconButton';

// The one back button for screens that still draw their own header
// (37-design-system-and-koban.md). Screens on the native Stack header don't
// need it. Goes back by default; pass onPress to override.
export default function BackButton({ onPress, style }) {
  const router = useRouter();
  return (
    <IconButton
      icon={ChevronLeft}
      size={24}
      accessibilityLabel="Back"
      onPress={onPress ?? (() => router.back())}
      style={style}
    />
  );
}
