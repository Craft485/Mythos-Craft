// Webpack doesn't seem to allow me to have entry points go out to multiple sub dirs
// So this script will take the results from out/client and place them in the correct static dirs under public

const path = require('path')
const map = require('./file-map.json')
const { readdir, readFile, writeFile } = require('fs')

!function () {
    if (process.argv[2].toUpperCase() === 'CLIENT') {
        readdir(path.resolve(__dirname, 'out/client'), { encoding: 'utf-8' }, (err, files) => {
            if (err) throw new Error(`Error reading directory 'out/client': ${err}`)
            
            for (const file of files) {
                const ext = file.split('.').pop()
                if (ext === 'js') {
                    readFile(path.resolve(__dirname, 'out/client', file), { encoding: 'utf-8' }, (err, data) => {
                        if (err) throw new Error(`Error reading file '${file}': ${err}`)
                        
                        const f = file.split('.')
                        f.pop()
                        f.join()
                        /** @type string */
                        const endpoint = map.client[f]
                        console.info(`Writing data from ${path.resolve(__dirname, 'out/client', file)} to ${path.resolve(__dirname, endpoint, file)}`)
                        
                        writeFile(path.resolve(__dirname, endpoint, file), data, { encoding: "utf-8" }, err => {
                            if (err) throw new Error(`Error writing to file '${file}': ${err}`)
                        })
                    })
                }
            }
        })
    } else if (process.argv[2].toUpperCase() === 'JSON') {
        // Populate specfic json files within ./src to ./out
        for (const entry of map.json) {
            const filePath = entry[0]
            const endpoint = entry[1]
            readFile(path.resolve(__dirname, 'src', filePath), { encoding: 'utf-8' }, (err, data) => {
                if (err) throw new Error(`Error reading file path src/${filePath}: ${err}`)

                console.info(`Writing data from ${path.resolve(__dirname, 'src', filePath)} to ${path.resolve(__dirname, 'out', endpoint || filePath.split('/').pop())}`)

                writeFile(path.resolve(__dirname, 'out', endpoint || filePath.split('/').pop()), data, { encoding: 'utf-8' }, (err) => {
                    if (err) throw new Error(`Error writing src/${filePath} to out/${endpoint}: ${err}`)
                })
            })
        }
    }
}()
