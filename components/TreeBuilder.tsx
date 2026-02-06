'use client';

import React, { useState, useRef } from 'react';

interface TextNode {
  id: string;
  type: 'text';
  label: string;
  color: string;
  x: number;
  y: number;
}

interface StockNode {
  id: string;
  type: 'stock';
  company: string;
  ticker: string;
  price: string | null;
  loading: boolean;
  simulated?: boolean;
  x: number;
  y: number;
}

interface SectorStock {
  ticker: string;
  price: string | null;
  loading: boolean;
}

interface SectorNode {
  id: string;
  type: 'sector';
  title: string;
  color: string;
  textColor: string;
  stocks: SectorStock[];
  x: number;
  y: number;
}

type Node = TextNode | StockNode | SectorNode;

interface Connection {
  id: string;
  from: string;
  to: string;
}

interface DragState {
  nodeId: string;
  startX: number;
  startY: number;
  nodeStartX: number;
  nodeStartY: number;
}

const TreeBuilder = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Add a new text node
  const addTextNode = () => {
    const newNode: TextNode = {
      id: `node-${Date.now()}`,
      type: 'text',
      label: 'New Label',
      color: '#e0e0e0',
      x: 100,
      y: 100 + nodes.length * 20
    };
    setNodes([...nodes, newNode]);
    setShowAddMenu(false);
  };

  // Add a new stock node
  const addStockNode = () => {
    const newNode: StockNode = {
      id: `node-${Date.now()}`,
      type: 'stock',
      company: 'Apple Inc.',
      ticker: 'AAPL',
      price: null,
      loading: false,
      x: 300,
      y: 100 + nodes.length * 20
    };
    setNodes([...nodes, newNode]);
    setShowAddMenu(false);
  };

  // Add a new sector node
  const addSectorNode = () => {
    const newNode: SectorNode = {
      id: `node-${Date.now()}`,
      type: 'sector',
      title: 'New Sector',
      color: '#1e3a5f',
      textColor: '#000000',
      stocks: [],
      x: 500,
      y: 100 + nodes.length * 20
    };
    setNodes([...nodes, newNode]);
    setShowAddMenu(false);
  };

  // Fetch stock price from Yahoo Finance via API route
  const fetchStockPrice = async (nodeId: string, ticker: string) => {
    if (!ticker || ticker.trim() === '') return;

    setNodes(prev => prev.map(n =>
      n.id === nodeId && n.type === 'stock' ? { ...n, loading: true, simulated: false } : n
    ));

    try {
      const response = await fetch(`/api/stock?ticker=${encodeURIComponent(ticker.trim())}`);
      const data = await response.json();

      if (!response.ok || data.price == null) {
        setNodes(prev => prev.map(n =>
          n.id === nodeId && n.type === 'stock' ? { ...n, price: 'N/A', loading: false, simulated: false } : n
        ));
        return;
      }

      setNodes(prev => prev.map(n =>
        n.id === nodeId && n.type === 'stock' ? { ...n, price: Number(data.price).toFixed(2), loading: false, simulated: false } : n
      ));
    } catch (error) {
      console.error('Stock price fetch error:', error);
      setNodes(prev => prev.map(n =>
        n.id === nodeId && n.type === 'stock' ? { ...n, price: 'Error', loading: false, simulated: false } : n
      ));
    }
  };

  // Handle mouse down on node
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setDragging({
      nodeId,
      startX: e.clientX,
      startY: e.clientY,
      nodeStartX: node.x,
      nodeStartY: node.y
    });
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;

    const deltaX = e.clientX - dragging.startX;
    const deltaY = e.clientY - dragging.startY;

    setNodes(prev => prev.map(n => 
      n.id === dragging.nodeId 
        ? { ...n, x: dragging.nodeStartX + deltaX, y: dragging.nodeStartY + deltaY }
        : n
    ));
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setDragging(null);
  };

  // Start connection
  const startConnection = (nodeId: string) => {
    if (connectingFrom === nodeId) {
      setConnectingFrom(null);
    } else if (connectingFrom) {
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        from: connectingFrom,
        to: nodeId
      };
      setConnections([...connections, newConnection]);
      setConnectingFrom(null);
    } else {
      setConnectingFrom(nodeId);
    }
  };

  // Delete node
  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));
    setSelectedNode(null);
  };

  // Delete connection
  const deleteConnection = (connId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connId));
  };

  // Update text node
  const updateTextNode = (nodeId: string, field: keyof TextNode, value: string) => {
    setNodes(prev => prev.map(n => 
      n.id === nodeId && n.type === 'text' ? { ...n, [field]: value } : n
    ));
  };

  // Update stock node
  const updateStockNode = (nodeId: string, company: string, ticker: string) => {
    setNodes(prev => prev.map(n => 
      n.id === nodeId && n.type === 'stock' ? { ...n, company, ticker } : n
    ));
  };

  // Fetch price for a ticker (called on blur or enter)
  const handleTickerSubmit = (nodeId: string, ticker: string) => {
    if (ticker && ticker.length > 0) {
      fetchStockPrice(nodeId, ticker);
    }
  };

  // Fetch price for a single stock within a sector node
  const fetchSectorStockPrice = async (nodeId: string, stockIndex: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'sector') return;
    const stock = node.stocks[stockIndex];
    if (!stock || !stock.ticker.trim()) return;

    setNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.type === 'sector') {
        const updatedStocks = [...n.stocks];
        updatedStocks[stockIndex] = { ...updatedStocks[stockIndex], loading: true };
        return { ...n, stocks: updatedStocks };
      }
      return n;
    }));

    try {
      const response = await fetch(`/api/stock?ticker=${encodeURIComponent(stock.ticker.trim())}`);
      const data = await response.json();

      setNodes(prev => prev.map(n => {
        if (n.id === nodeId && n.type === 'sector') {
          const updatedStocks = [...n.stocks];
          if (!response.ok || data.price == null) {
            updatedStocks[stockIndex] = { ...updatedStocks[stockIndex], price: 'N/A', loading: false };
          } else {
            updatedStocks[stockIndex] = { ...updatedStocks[stockIndex], price: Number(data.price).toFixed(2), loading: false };
          }
          return { ...n, stocks: updatedStocks };
        }
        return n;
      }));
    } catch (error) {
      console.error('Sector stock price fetch error:', error);
      setNodes(prev => prev.map(n => {
        if (n.id === nodeId && n.type === 'sector') {
          const updatedStocks = [...n.stocks];
          updatedStocks[stockIndex] = { ...updatedStocks[stockIndex], price: 'Error', loading: false };
          return { ...n, stocks: updatedStocks };
        }
        return n;
      }));
    }
  };

  // Refresh all stock prices in a sector node
  const refreshAllSectorPrices = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'sector') return;
    node.stocks.forEach((_, index) => {
      fetchSectorStockPrice(nodeId, index);
    });
  };

  // Add a stock to a sector node
  const addStockToSector = (nodeId: string, ticker: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.type === 'sector') {
        return { ...n, stocks: [...n.stocks, { ticker: ticker.toUpperCase(), price: null, loading: false }] };
      }
      return n;
    }));
  };

  // Remove a stock from a sector node
  const removeStockFromSector = (nodeId: string, stockIndex: number) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.type === 'sector') {
        const updatedStocks = n.stocks.filter((_, i) => i !== stockIndex);
        return { ...n, stocks: updatedStocks };
      }
      return n;
    }));
  };

  // Update sector title
  const updateSectorTitle = (nodeId: string, title: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.type === 'sector') {
        return { ...n, title };
      }
      return n;
    }));
  };

  // Update sector color
  const updateSectorColor = (nodeId: string, color: string) => {
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId && n.type === 'sector') {
        return { ...n, color };
      }
      return n;
    }));
  };

  // State for new sector stock input
  const [newSectorTicker, setNewSectorTicker] = useState('');

  return (
    <div
      className="w-full h-screen bg-gray-900 text-white"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Toolbar */}
      <div className="bg-gray-800 p-4 border-b border-gray-700 flex gap-4 items-center">
        <h1 className="text-xl font-bold">Hierarchical Tree Builder</h1>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
          >
            Add Node +
          </button>
          {showAddMenu && (
            <div className="absolute top-full mt-2 bg-gray-700 rounded shadow-lg z-50">
              <button
                onClick={addTextNode}
                className="block w-full text-left px-4 py-2 hover:bg-gray-600 whitespace-nowrap"
              >
                Text Label Node
              </button>
              <button
                onClick={addStockNode}
                className="block w-full text-left px-4 py-2 hover:bg-gray-600 whitespace-nowrap"
              >
                Stock Ticker Node
              </button>
              <button
                onClick={addSectorNode}
                className="block w-full text-left px-4 py-2 hover:bg-gray-600 whitespace-nowrap"
              >
                Sector Node
              </button>
            </div>
          )}
        </div>
        {connectingFrom && (
          <div className="text-yellow-400">
            Connecting mode active - click another node to connect
          </div>
        )}
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden bg-gray-950" ref={canvasRef}>
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {connections.map(conn => {
              const fromNode = nodes.find(n => n.id === conn.from);
              const toNode = nodes.find(n => n.id === conn.to);
              if (fromNode && toNode) {
                const fromHalfW = fromNode.type === 'sector' ? 110 : 75;
                const toHalfW = toNode.type === 'sector' ? 110 : 75;
                const fromX = fromNode.x + fromHalfW;
                const fromY = fromNode.y + 40;
                const toX = toNode.x + toHalfW;
                const toY = toNode.y + 40;
                return (
                  <line
                    key={conn.id}
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke="#666"
                    strokeWidth="2"
                  />
                );
              }
              return null;
            })}
          </svg>

          {nodes.map(node => (
            <div
              key={node.id}
              onMouseDown={(e) => handleMouseDown(e, node.id)}
              onClick={() => setSelectedNode(node.id)}
              onDoubleClick={() => startConnection(node.id)}
              className={`absolute cursor-move rounded p-3 shadow-lg select-none ${
                selectedNode === node.id ? 'ring-2 ring-blue-500' : ''
              } ${connectingFrom === node.id ? 'ring-2 ring-yellow-500' : ''}`}
              style={{
                left: node.x,
                top: node.y,
                width: node.type === 'sector' ? '220px' : '150px',
                backgroundColor: node.type === 'text' ? node.color : node.type === 'sector' ? node.color : '#1f2937'
              }}
            >
              {node.type === 'text' ? (
                <div className="text-sm font-semibold" style={{ color: '#000' }}>
                  {node.label}
                </div>
              ) : node.type === 'stock' ? (
                <div>
                  <div className="text-xs font-semibold text-gray-300">
                    {node.company}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {node.ticker}
                  </div>
                  <div className="text-lg font-bold text-green-400 mt-1">
                    {node.loading ? '...' : node.price ? `$${node.price}` : '-'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-bold mb-2" style={{ color: node.textColor }}>
                    {node.title}
                  </div>
                  {node.stocks.length === 0 ? (
                    <div className="text-xs italic" style={{ color: node.textColor, opacity: 0.6 }}>No stocks added</div>
                  ) : (
                    <div className="space-y-1">
                      {node.stocks.map((stock, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="font-medium" style={{ color: node.textColor }}>{stock.ticker}</span>
                          <span className="font-bold" style={{ color: node.textColor }}>
                            {stock.loading ? '...' : stock.price ? `$${stock.price}` : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Properties Panel */}
        <div className="w-80 bg-gray-800 p-4 border-l border-gray-700 overflow-auto">
          <h2 className="text-lg font-bold mb-4">Properties</h2>
          
          {selectedNode ? (
            <div className="space-y-4">
              {(() => {
                const selectedNodeData = nodes.find(n => n.id === selectedNode);
                if (!selectedNodeData) return null;

                if (selectedNodeData.type === 'text') {
                  return (
                    <>
                      <div>
                        <label className="block text-sm mb-2">Label</label>
                        <input
                          type="text"
                          maxLength={30}
                          value={selectedNodeData.label}
                          onChange={(e) => updateTextNode(selectedNode, 'label', e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                        <div className="text-xs text-gray-400 mt-1">
                          {selectedNodeData.label.length}/30 characters
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm mb-2">Background Color</label>
                        <input
                          type="color"
                          value={selectedNodeData.color}
                          onChange={(e) => updateTextNode(selectedNode, 'color', e.target.value)}
                          className="w-full h-10 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                        />
                      </div>
                    </>
                  );
                }

                if (selectedNodeData.type === 'stock') {
                  return (
                    <>
                      <div>
                        <label className="block text-sm mb-2">Company Name</label>
                        <input
                          type="text"
                          value={selectedNodeData.company}
                          onChange={(e) => updateStockNode(selectedNode, e.target.value, selectedNodeData.ticker)}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2">Stock Ticker</label>
                        <input
                          type="text"
                          value={selectedNodeData.ticker}
                          onChange={(e) => updateStockNode(selectedNode, selectedNodeData.company, e.target.value.toUpperCase())}
                          onBlur={(e) => handleTickerSubmit(selectedNode, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleTickerSubmit(selectedNode, e.currentTarget.value);
                            }
                          }}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                          placeholder="e.g., AAPL"
                        />
                        <div className="text-xs text-gray-400 mt-1">
                          Press Enter or click away to fetch price
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (selectedNodeData.ticker) fetchStockPrice(selectedNode, selectedNodeData.ticker);
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
                      >
                        Refresh Price
                      </button>
                    </>
                  );
                }

                if (selectedNodeData.type === 'sector') {
                  return (
                    <>
                      <div>
                        <label className="block text-sm mb-2">Title</label>
                        <input
                          type="text"
                          value={selectedNodeData.title}
                          onChange={(e) => updateSectorTitle(selectedNode, e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2">Background Color</label>
                        <input
                          type="color"
                          value={selectedNodeData.color}
                          onChange={(e) => updateSectorColor(selectedNode, e.target.value)}
                          className="w-full h-10 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2">Text Color</label>
                        <input
                          type="color"
                          value={selectedNodeData.textColor}
                          onChange={(e) => {
                            setNodes(prev => prev.map(n =>
                              n.id === selectedNode && n.type === 'sector' ? { ...n, textColor: e.target.value } : n
                            ));
                          }}
                          className="w-full h-10 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2">Stocks</label>
                        {selectedNodeData.stocks.length === 0 ? (
                          <div className="text-xs text-gray-400 mb-2">No stocks added yet</div>
                        ) : (
                          <div className="space-y-1 mb-2">
                            {selectedNodeData.stocks.map((stock, i) => (
                              <div key={i} className="flex items-center justify-between bg-gray-700 px-3 py-1 rounded text-sm">
                                <span>{stock.ticker}</span>
                                <button
                                  onClick={() => removeStockFromSector(selectedNode, i)}
                                  className="text-red-400 hover:text-red-300 ml-2"
                                >
                                  x
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newSectorTicker}
                            onChange={(e) => setNewSectorTicker(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newSectorTicker.trim()) {
                                addStockToSector(selectedNode, newSectorTicker.trim());
                                const newIndex = selectedNodeData.stocks.length;
                                setTimeout(() => fetchSectorStockPrice(selectedNode, newIndex), 50);
                                setNewSectorTicker('');
                              }
                            }}
                            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                            placeholder="e.g., AAPL"
                          />
                          <button
                            onClick={() => {
                              if (newSectorTicker.trim()) {
                                addStockToSector(selectedNode, newSectorTicker.trim());
                                const newIndex = selectedNodeData.stocks.length;
                                setTimeout(() => fetchSectorStockPrice(selectedNode, newIndex), 50);
                                setNewSectorTicker('');
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => refreshAllSectorPrices(selectedNode)}
                        className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
                      >
                        Refresh All Prices
                      </button>
                    </>
                  );
                }

                return null;
              })()}
              
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={() => deleteNode(selectedNode)}
                  className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
                >
                  Delete Node
                </button>
              </div>
              
              <div className="text-xs text-gray-400 pt-4 border-t border-gray-700">
                <p className="font-semibold mb-2">Instructions:</p>
                <ul className="space-y-1">
                  <li>• Drag nodes to move them</li>
                  <li>• Double-click nodes to connect</li>
                  <li>• Single-click to select and edit</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-sm">
              <p>Select a node to edit its properties</p>
              <div className="mt-4 space-y-2">
                <p className="font-semibold">Quick Start:</p>
                <ul className="space-y-1">
                  <li>1. Click &quot;Add Node +&quot; to create nodes</li>
                  <li>2. Drag nodes to position them</li>
                  <li>3. Double-click to start connecting</li>
                  <li>4. Click a node to edit properties</li>
                </ul>
              </div>
            </div>
          )}

          {connections.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h3 className="text-sm font-semibold mb-2">Connections ({connections.length})</h3>
              <div className="space-y-2">
                {connections.map(conn => {
                  const fromNode = nodes.find(n => n.id === conn.from);
                  const toNode = nodes.find(n => n.id === conn.to);
                  return (
                    <div key={conn.id} className="flex items-center justify-between bg-gray-700 p-2 rounded text-xs">
                      <span className="truncate">
                        {fromNode?.type === 'text' ? (fromNode as TextNode).label : fromNode?.type === 'stock' ? (fromNode as StockNode).company : (fromNode as SectorNode).title} → {toNode?.type === 'text' ? (toNode as TextNode).label : toNode?.type === 'stock' ? (toNode as StockNode).company : (toNode as SectorNode).title}
                      </span>
                      <button
                        onClick={() => deleteConnection(conn.id)}
                        className="text-red-400 hover:text-red-300 ml-2 flex-shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TreeBuilder;
