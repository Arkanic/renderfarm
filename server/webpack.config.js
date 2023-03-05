const path = require("path");
const {CleanWebpackPlugin} = require("clean-webpack-plugin");
const TerserJSPlugin = require("terser-webpack-plugin");

function relative(dir) {
    return path.resolve(__dirname, dir);
}

module.exports = {
    mode: "production",

    stats: {
        children: true
    },

    entry: {
        dashboard: relative("./dashboard/ts/index.ts")
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
            }
        ]
    },

    plugins: [
        new CleanWebpackPlugin({})
    ]
}