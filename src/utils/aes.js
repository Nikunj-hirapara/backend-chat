var crypto = require('crypto');
const config = require('config');
var PKCS7Encoder = {};

PKCS7Encoder.decode = function (text) {
    var pad = text[text.length - 1];

    if (pad < 1 || pad > 16) {
        pad = 0;
    }

    return text.slice(0, text.length - pad);
};

PKCS7Encoder.encode = function (text) {
    var blockSize = 16;
    var textLength = text.length;

    var amountToPad = blockSize - (textLength % blockSize);

    var result = new Buffer(amountToPad);
    result.fill(amountToPad);

    return Buffer.concat([text, result]);
};

function generateString(length) {
    if (length === 0) {
        throw new Error('Zero-length randomString is useless.');
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789';
    let objectId = '';
    const bytes = crypto.randomBytes(length);

    for (let i = 0; i < bytes.length; ++i) {
        objectId += chars[bytes.readUInt8(i) % chars.length];
    }

    return objectId;
}


exports.encrypt = function (text, key) {
    key = key.split("-").join("").trim()
    var encoded = PKCS7Encoder.encode(Buffer.from(text));

    var iv = /*generateString(16)*/ config.get('OUTER_KEY_IV')
    var cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    cipher.setAutoPadding(false);
    var cipheredMsg = Buffer.concat([cipher.update(encoded), cipher.final()]);
    return iv + cipheredMsg.toString('base64');
};

exports.decrypt = function (text, key) {
    var iv = text.toString().substring(0, 16);
    var decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    var deciphered = Buffer.concat([decipher.update(text.replace(iv.toString(), ""), 'base64'), decipher.final()]);
    deciphered = PKCS7Encoder.decode(deciphered);
    return deciphered.toString();
};
