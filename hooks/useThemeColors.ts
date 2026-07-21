import { useStore } from '../context/useStore';
import { getThemeColors } from '../utils/theme';

export const useThemeColors = () => {
  const isDarkMode = useStore((state) => state.isDarkMode);
  const colors = getThemeColors(isDarkMode);
  return { colors, isDarkMode };
};
