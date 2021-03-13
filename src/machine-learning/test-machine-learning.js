// https://github.com/BrainJS/brain.js#examples
const brain = require('brain.js');
const fs = require('fs');
const asciichart = require('asciichart')
const start = new Date();

console.log(start);
const config = {
    binaryThresh: 0.5,
    hiddenLayers: [3], // array of ints for the sizes of the hidden layers in the network
    activation: 'sigmoid', // supported activation types: ['sigmoid', 'relu', 'leaky-relu', 'tanh'],
    leakyReluAlpha: 0.01, // supported for activation type 'leaky-relu'
};
const net = new brain.NeuralNetwork(config);
const percentTrainData = 0.75;
const maxNbData = null; // null if no limit
fs.readFile('src/machine-learning/extract_odds_waver.json', 'utf8', (err, datas) => {
    if (err) {
        return console.log(err);
    }
    datas = JSON.parse(datas);
    // region limit the number of data
    if (!isNaN(maxNbData) && maxNbData !== null) {
        datas = datas.filter((x, i) => i < maxNbData);
    }
    // endregion
    const dataSize = datas.length;
    console.log('Data size: ' + dataSize);
    const trainData = [];
    const testData = [];
    for (let i = 0; i < dataSize; i++) {
        const input = [
            datas[i].odd,
            datas[i].variation_abs,
            datas[i].balance,
            datas[i].variance,
        ];
        const output = [datas[i].gain];
        if (i / dataSize < percentTrainData) {
            trainData.push({
                input: input,
                output: output,
            });
        } else {
            testData.push({
                input: input,
                output: output,
            });
        }
    }
    console.log('trainData size: ' + trainData.length);
    console.log('testData size: ' + testData.length);

    console.log('Start learning ...');
    net.train(trainData);
    console.log('Learning done !');
    const chartData = [];
    const resultToSaveFile = [];
    for (let test of testData) {
        const output = parseFloat(net.run(test.input));
        const expected = test.output[0];
        resultToSaveFile.push({expected: expected, output: output});
        chartData.push(output / expected)
    }
    // region results
    const end = new Date();
    const fileName = end.toDateString() + '_' + trainData.length + '_' + testData.length;
    console.log('Plus les valeurs sont proches de 1 et constantes (' + fileName + '_chart.txt) plus le machine learning est bon');
    const time = Math.trunc((end.getTime() - start.getTime()) / 1000)
    console.log('Time in seconds : ' + time)
    fs.writeFile('src/machine-learning/result/' + fileName + '_data.json', JSON.stringify(resultToSaveFile), (err) => {
        if (err) return console.log(err);
    });
    fs.writeFile('src/machine-learning/result/' + fileName + '_chart.txt', asciichart.plot(chartData), (err) => {
        if (err) return console.log(err);
    });
    // endregion
    console.log('Done');
});