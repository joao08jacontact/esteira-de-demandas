import { memo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const CustomNode = memo(({ data, id }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label || "");
  const [content, setContent] = useState(data.content || "");

  const handleLabelBlur = () => {
    if (data.onChange) {
      data.onChange(id, { label, content });
    }
    setIsEditing(false);
  };

  const handleContentBlur = () => {
    if (data.onChange) {
      data.onChange(id, { label, content });
    }
  };

  const isTextNode = data.nodeType === "text";

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      {isTextNode ? (
        <div
          className="px-4 py-2 bg-transparent min-w-[120px]"
          onDoubleClick={() => setIsEditing(true)}
        >
          {isEditing ? (
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleLabelBlur}
              autoFocus
              className="text-sm font-medium"
            />
          ) : (
            <div className="text-sm font-medium text-foreground cursor-pointer">
              {label || "Duplo clique para editar"}
            </div>
          )}
        </div>
      ) : (
        <Card className="min-w-[200px] max-w-[300px] shadow-md">
          <div className="p-3 space-y-2">
            {isEditing ? (
              <>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onBlur={handleLabelBlur}
                  placeholder="Título"
                  className="font-medium text-sm"
                  autoFocus
                />
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onBlur={handleContentBlur}
                  placeholder="Conteúdo..."
                  className="text-xs min-h-[60px]"
                />
              </>
            ) : (
              <div
                onDoubleClick={() => setIsEditing(true)}
                className="cursor-pointer"
              >
                <div className="font-medium text-sm text-foreground mb-1">
                  {label || "Duplo clique para editar"}
                </div>
                {content && (
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {content}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
});

CustomNode.displayName = "CustomNode";
