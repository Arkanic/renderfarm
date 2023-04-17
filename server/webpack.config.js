const path = require("path");
const autoprefixer = require("autoprefixer");
const {CleanWebpackPlugin} = require("clean-webpack-plugin");
const TerserJSPlugin = require("terser-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

function relative(dir) {
    return path.resolve(__dirname, dir);
}

module.exports = {
    mode: "production",

    stats: {
        children: true
    },

    entry: {
        dashboard: relative("./dashboard/index.ts")
    },

    output: {
        filename: "[name].js",
        path: relative("./dashboard-build")
    },

    optimization: {
        minimizer: [
            new TerserJSPlugin({})
        ],
        usedExports: true
    },

    resolve: {
        extensions: [
            ".ts", ".tsx",
            ".js"
        ]
    },

    module: {
        rules: [
            {
                test: /.tsx?/,
                exclude: /node_modules/,
                loader: "ts-loader"
            },
            {
                test: /\.(scss)$/,
                use: [
                    "style-loader",
                    "css-loader",
                    {
                        loader: "postcss-loader",
                        options: {
                            postcssOptions: {
                                plugins:() => [
                                    autoprefixer
                                ]
                            }
                        }
                    },
                    "sass-loader"
                ]
            }
        ]
    },

    plugins: [
        new CleanWebpackPlugin({}),
        new HtmlWebpackPlugin({
            template: relative("./dashboard/index.html")
        })
    ]
}