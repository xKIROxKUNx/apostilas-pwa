import { IconButton } from "./index";
import { Refresh } from "./icons";

export function RefreshButton() {
  return (
    <IconButton label="Atualizar a página" onClick={() => location.reload()}>
      <Refresh />
    </IconButton>
  );
}
