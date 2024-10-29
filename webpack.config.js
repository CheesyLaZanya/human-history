const path = require('path');

module.exports = {
  entry: './src/script.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  devtool: false,
  devServer: {
    static: {
      directory: path.join(__dirname, '/'),
    },
    compress: true,
    port: 8000,
  },
};