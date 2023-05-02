const path = require('path')

module.exports = {
    mode: 'production',
    target: 'web',
    output: {
        path: path.resolve(__dirname, 'out/client')
    },
    entry: {
        game: { import: path.resolve(__dirname, 'src/client/game.mts'), filename: 'game-main.js' },
        login: { import: path.resolve(__dirname, 'src/client/login.mts') },
        profile: { import: path.resolve(__dirname, 'src/client/profile.mts') }
    },
    module: {
        rules: [
            {
                test: /\.m?tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    }
}