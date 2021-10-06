/* eslint-env node */
const path = require("path");

module.exports = {
  mode: "production",
  entry: "./src/api.ts",
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    library: {
      type: "umd",
    },
    filename: "api.js",
    path: path.resolve(process.cwd(), "dist"),
  },
};
