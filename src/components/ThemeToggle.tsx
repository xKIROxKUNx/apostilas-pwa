import { useTheme } from "@/state/ThemeContext";
import { IconButton } from "./index";
import { DarkMode, LightMode } from "./icons";

export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const indoPara = resolved === "dark" ? "claro" : "escuro";

  return (
    <IconButton label={`Mudar para o tema ${indoPara}`} onClick={toggle}>
      {resolved === "dark" ? <LightMode /> : <DarkMode />}
    </IconButton>
  );
}
