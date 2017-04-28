var Recorder = (function(){
    function Recorder(source) {
        this.recBuffer = [];
        this.recording = false;
        this.recLength = 0;
        this.volume = null;
        
        this.config = {
            bufferLen: 2048,
            mimeType: 'audio/wav',
            compression: 4
        };

        this.context = source.context;
        var $this = this;

        var volume = this.context.createGain();
        source.connect(volume);
        this.node = (this.context.createScriptProcessor || this.context.createJavaScriptNode).call(this.context, this.config.bufferLen, 1, 1);
        this.node.onaudioprocess = function(e) {
            if (!$this.recording) return;
            // 提取左声道
            var channelBuffer = e.inputBuffer.getChannelData(0);
            $this.recBuffer.push(new Float32Array(channelBuffer));
            $this.recLength += $this.config.bufferLen;
        };

        volume.connect(this.node);
        this.node.connect(this.context.destination);
    }

    /**
     * 开始录音
     *
     * @author sosoyi <sosoyi@aliyun.com>
     */
    Recorder.prototype.startRecord = function () {
        this.recording = true;
    };

    /**
     * 停止录音
     *
     * @author sosoyi <sosoyi@aliyun.com>
     */
    Recorder.prototype.stopRecord = function () {
        this.recording = false;
    };

    /**
     * 导出录音
     *
     * @author sosoyi <sosoyi@aliyun.com>
     */
    Recorder.prototype.exportRecord = function (cb,mimeType) {
        mimeType = mimeType || this.config.mimeType;
        if (!cb) throw new Error('Callback not set');
        var dataview = this.getBuffer();
        var audioBlob = new Blob([dataview], { type: mimeType });
        cb(audioBlob);
    };

    Recorder.prototype.getBuffer = function () {
        var channelBuffer = this.mergeBuffers(this.recBuffer, this.recLength);
        var interleaved = this.interleave(channelBuffer);
        var sampleRateTmp = 11025 ;//sampleRate;//写入新的采样率
        var sampleBits = 16;//这里改成8位
        var channelCount = 1;
        var dataLength = interleaved.length * (sampleBits / 8);

        var buffer = new ArrayBuffer(44 + dataLength);
        var view = new DataView(buffer);


        this.writeUTFBytes(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        this.writeUTFBytes(view, 8, 'WAVE');
        this.writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        /* 通道数 */
        view.setUint16(22, channelCount , true);
        view.setUint32(24, sampleRateTmp, true);
        view.setUint32(28, sampleRateTmp * channelCount * (sampleBits / 8), true);
        view.setUint16(32, channelCount * (sampleBits / 8), true);
        view.setUint16(34, sampleBits, true);
        this.writeUTFBytes(view, 36, 'data');
        view.setUint32(40, dataLength / 4, true);

        var lng = interleaved.length;
        var index = 44;
        var volume = 1;
        for (var i = 0; i < lng; i++) {
            view.setInt16(index, interleaved[i] * (0x7FFF * volume), true);
            index += 2;
        }
        return view;
    };

    Recorder.prototype.mergeBuffers = function (channelBuffer,recordingLength) {
        var result = new Float32Array(recordingLength);
        var offset = 0;
        var lng = channelBuffer.length;
        for (var i = 0; i < lng; i++) {
            var buffer = channelBuffer[i];
            result.set(buffer, offset);
            offset += buffer.length;
        }
        return result;
    };

    Recorder.prototype.interleave = function (channelBuffer) {
        // var length = leftChannel.length + rightChannel.length;
        var length = channelBuffer.length;
        var compression = this.config.compression;
        var result = new Float32Array(length);

        var inputIndex = 0;

        for (var index = 0; index < length;) {
            result[index++] = channelBuffer[inputIndex];
            inputIndex += compression;//每次都跳过3个数据
        }
        return result;
    };

    Recorder.prototype.writeUTFBytes = function(view, offset, string) {
        var lng = string.length;
        for (var i = 0; i < lng; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    Recorder.prototype.clear = function() {
        this.recLength = 0;
        this.recBuffer = [];
    };


    return Recorder;
})();