# Hierarchical Tree Builder

A web-based application for creating hierarchical trees with two types of nodes:
- **Text Label Nodes**: Customizable colored labels (up to 30 characters)
- **Stock Ticker Nodes**: Display live stock prices using real-time data

## Features

- 🎨 Drag-and-drop node positioning
- 🔗 Connect nodes with lines
- 📊 Real-time stock price fetching
- 🎯 Interactive properties panel
- 💾 Clean, modern dark theme UI

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone this repository
```bash
git clone <your-repo-url>
cd tree-builder-app
```

2. Install dependencies
```bash
npm install
```

3. Run the development server
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment on Vercel

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Click "Deploy"

That's it! Vercel will automatically detect it's a Next.js app and configure everything.

## How to Use

1. **Add Nodes**: Click "Add Node +" to create text or stock nodes
2. **Move Nodes**: Drag nodes to position them anywhere on the canvas
3. **Connect Nodes**: Double-click one node, then double-click another to create a connection
4. **Edit Properties**: Single-click a node to edit its properties in the right panel
5. **Stock Prices**: Enter a ticker symbol and press Enter to fetch the current price

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Anthropic Claude API (for stock price fetching)

## License

MIT
