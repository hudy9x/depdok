import { useTheme } from "next-themes";
import { ZoomPanContainer } from "@/components/ZoomPanContainer";

import {
  DiagramProvider,
  SequenceDiagram,
  ParticipantMenuBar,
  MessageMenuBar,
  AltMenuBar,
  GroupMenuBar,
  LoopMenuBar,
  DividerMenuBar,
  NoteMenuBar,

} from "beautiful-plantuml";

interface PlantUMLBrowserPreviewProps {
  content: string;
  onContentChange?: (content: string) => void;
}

export function PlantUMLBrowserPreview({
  content,
  onContentChange,
}: PlantUMLBrowserPreviewProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="w-full h-full relative overflow-hidden bg-background">
      <ZoomPanContainer
        config={{ minZoom: 0.1, maxZoom: 5, initialZoom: 0.8, centerOnLoad: true }}
      >
        <DiagramProvider
          code={content}
          onChange={onContentChange}
          theme={resolvedTheme === "dark" ? "nord-dark" : "zinc-light"}
        >
          <SequenceDiagram enableHoverLayer={false} />
          <ParticipantMenuBar />
          <MessageMenuBar />
          <AltMenuBar />
          <GroupMenuBar />
          <LoopMenuBar />
          <DividerMenuBar />
          <NoteMenuBar />
        </DiagramProvider>
      </ZoomPanContainer>
    </div>
  );
}
