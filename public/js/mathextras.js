Math = Math || {};

/*
 * Computes a simple Gaussian normal
 *
 * @param {Float} x Dependent variable input
 *
 * @returns {Float} The Gaussian amplitude at point x
 * TODO:  Parameterize amplitude and spread
 */
 Math.gaussian = function(x) {
    return 4.0 * Math.exp( -1.0 * Math.pow(x , 2) / 1024.0 );
};

/*
 *
 * Creates a function that computes a simplistic noise function based on the implementation RNG
 *
 * Note that the function returned memoizes its values for a given input x, thus making it safe
 * and idempotent (approximately pure) for the same input value while maintaining laziness.
 *
 * @param {Float} amplitude The desired (approximate!) RMS amplitude of the noise function
 *
 * @returns {Function} A parameterized noise function
 */
 Math.noise = function (amplitude) {
    var memo = {};
    return function (x) {
        if (x in memo) {
            return memo[x];
        } else {

            return memo[x] = amplitude * Math.random() * (Math.random() > 0.5 ? -1 : 1);
        }
    };
};

/*
 * The null function
 *
 * @returns {Float} Always returns 0.0
 */
 Math.zeroFunction = function () { return 0.0; };

/*
 * Logarithm in base 10
 *
 * @param {Float} x Input value
 *
 * @returns {Float} The base 10 logarithm of x
 */
 Math.log10 = function (x) { return Math.log(x) / Math.log(10); };

/*
 * Converts a value on a linear scale to a logarithmic Decibel scale
 *
 * @param {Float} x Linear value to convert
 *
 * @returns {Float} The standard decibel representation of the value
 */
 Math.toDecibels = function (x) { return 20.0 * Math.log10(x); };

 Math.randInt = function(max, min) {
    if (min === undefined) {
        min = 0;
    }
    return Math.floor( Math.random() * max  + min);
}