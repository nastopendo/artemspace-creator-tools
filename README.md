# Artemspace creator tools

A web application with multiple tools including an image resizer.

## Project Structure

├── src/
│ ├── main.js
│ └── pages/
│ ├── image-resizer/
│ │ └── index.html
│ └── homepage/
│ └── index.html
├── public/
│ ├── .htaccess
│ └── \_redirects
├── dist/
│ ├── .htaccess
│ ├── \_redirects
│ └── index.html
├── index.html
└── vite.config.js

## Development

### Prerequisites

- npm or yarn

### Setup

1. Clone the repository:

```bash
git clone https://github.com/nastopendo/artemspace-creator-tools.git
cd artemspace-creator-tools
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Start development server:

```bash
npm run dev
# or
yarn dev
```

### Building for Production

To create a production build:

```bash
npm run build
# or
yarn build
```

The built files will be in the `dist` directory.

## Features

- Image Resizer Tool
