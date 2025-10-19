import { useCallback, useState, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Square, Type } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CustomNode } from "@/components/bi/custom-node";

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export function BiCanvas() {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  
  // Use refs to always have latest values in closures
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const saveCanvas = async (currentNodes: Node[], currentEdges: Edge[]) => {
    try {
      await apiRequest("POST", "/api/canvas", {
        nodes: currentNodes.map((node) => ({
          id: node.id,
          type: node.type || "custom",
          positionX: node.position.x.toString(),
          positionY: node.position.y.toString(),
          data: JSON.stringify({
            label: node.data.label,
            content: node.data.content,
            nodeType: node.data.nodeType,
          }),
        })),
        edges: currentEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type || "smoothstep",
          animated: edge.animated || false,
        })),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/canvas"] });
    } catch (error) {
      toast({
        title: "Erro ao salvar canvas",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    }
  };

  const handleNodeChange = useCallback(
    (nodeId: string, newData: any) => {
      setNodes((nds) => {
        const updatedNodes = nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
        );
        // Use ref to get latest edges value
        saveCanvas(updatedNodes, edgesRef.current);
        return updatedNodes;
      });
    },
    [setNodes]
  );

  // Load canvas data
  const { data: canvasData } = useQuery({
    queryKey: ["/api/canvas"],
  });

  useEffect(() => {
    if (canvasData) {
      const loadedNodes = canvasData.nodes?.map((node: any) => ({
        id: node.id,
        type: node.type,
        position: { x: parseFloat(node.positionX), y: parseFloat(node.positionY) },
        data: {
          ...JSON.parse(node.data),
          onChange: handleNodeChange,
        },
      })) || [];

      const loadedEdges = canvasData.edges?.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        animated: edge.animated,
      })) || [];

      setNodes(loadedNodes);
      setEdges(loadedEdges);

      if (loadedNodes.length > 0) {
        const maxId = Math.max(...loadedNodes.map((n: any) => {
          const match = n.id.match(/\d+$/);
          return match ? parseInt(match[0]) : 0;
        }));
        setNodeIdCounter(maxId + 1);
      }
    }
  }, [canvasData]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
        type: "smoothstep",
        animated: true,
      };
      setEdges((eds) => {
        const updatedEdges = addEdge(newEdge as Edge, eds);
        saveCanvas(nodesRef.current, updatedEdges);
        return updatedEdges;
      });
    },
    [setEdges]
  );

  const addNode = (type: "box" | "text") => {
    const newNode: Node = {
      id: `node-${nodeIdCounter}`,
      type: "custom",
      position: {
        x: 100 + nodeIdCounter * 20,
        y: 100 + nodeIdCounter * 20,
      },
      data: {
        label: type === "box" ? `Elemento ${nodeIdCounter}` : `Texto ${nodeIdCounter}`,
        content: "",
        nodeType: type,
        onChange: handleNodeChange,
      },
    };

    setNodes((nds) => {
      const updatedNodes = [...nds, newNode];
      saveCanvas(updatedNodes, edgesRef.current);
      return updatedNodes;
    });
    setNodeIdCounter((c) => c + 1);
  };

  const handleNodesChangeWrapper = useCallback(
    (changes: any) => {
      onNodesChange(changes);
      // Save after node changes (position, delete, etc.)
      setTimeout(() => {
        setNodes((currentNodes) => {
          setEdges((currentEdges) => {
            saveCanvas(currentNodes, currentEdges);
            return currentEdges;
          });
          return currentNodes;
        });
      }, 300);
    },
    [onNodesChange, setNodes, setEdges]
  );

  const handleEdgesChangeWrapper = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      // Save after edge changes (delete, etc.)
      setTimeout(() => {
        setEdges((currentEdges) => {
          setNodes((currentNodes) => {
            saveCanvas(currentNodes, currentEdges);
            return currentNodes;
          });
          return currentEdges;
        });
      }, 300);
    },
    [onEdgesChange, setEdges, setNodes]
  );

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border bg-card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addNode("box")}
            data-testid="button-add-box"
          >
            <Square className="h-4 w-4 mr-1" />
            Adicionar Caixa
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addNode("text")}
            data-testid="button-add-text"
          >
            <Type className="h-4 w-4 mr-1" />
            Adicionar Texto
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Arraste os elementos e conecte-os para criar fluxogramas
        </div>
      </div>
      <div className="h-[600px] bg-muted/20" data-testid="canvas-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChangeWrapper}
          onEdgesChange={handleEdgesChangeWrapper}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              return "hsl(var(--primary))";
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        </ReactFlow>
      </div>
    </Card>
  );
}
