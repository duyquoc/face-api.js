import { isTensor1D, isTensor4D, isTensor3D } from '../commons/isTensor';
import { loadWeightMap } from '../commons/loadWeightMap';
import { BoxPredictionParams, MobileNetV1, PointwiseConvParams, PredictionLayerParams } from './types';

const DEFAULT_MODEL_NAME = 'face_detection_model'

function extractorsFactory(weightMap: any) {

  function extractPointwiseConvParams(prefix: string, idx: number): PointwiseConvParams {

    const pointwise_conv_params = {
      filters: weightMap[`${prefix}/Conv2d_${idx}_pointwise/weights`],
      batch_norm_offset: weightMap[`${prefix}/Conv2d_${idx}_pointwise/convolution_bn_offset`]
    }

    if (!isTensor4D(pointwise_conv_params.filters)) {
      throw new Error(`expected weightMap[${prefix}/Conv2d_${idx}_pointwise/weights] to be a Tensor4D, instead have ${pointwise_conv_params.filters}`)
    }

    if (!isTensor1D(pointwise_conv_params.batch_norm_offset)) {
      throw new Error(`expected weightMap[${prefix}/Conv2d_${idx}_pointwise/convolution_bn_offset] to be a Tensor1D, instead have ${pointwise_conv_params.batch_norm_offset}`)
    }

    return pointwise_conv_params
  }

  function extractConvPairParams(idx: number): MobileNetV1.ConvPairParams {

    const depthwise_conv_params = {
      filters: weightMap[`MobilenetV1/Conv2d_${idx}_depthwise/depthwise_weights`],
      batch_norm_scale: weightMap[`MobilenetV1/Conv2d_${idx}_depthwise/BatchNorm/gamma`],
      batch_norm_offset: weightMap[`MobilenetV1/Conv2d_${idx}_depthwise/BatchNorm/beta`],
      batch_norm_mean: weightMap[`MobilenetV1/Conv2d_${idx}_depthwise/BatchNorm/moving_mean`],
      batch_norm_variance: weightMap[`MobilenetV1/Conv2d_${idx}_depthwise/BatchNorm/moving_variance`],
    }

    if (!isTensor4D(depthwise_conv_params.filters)) {
      throw new Error(`expected weightMap[MobilenetV1/Conv2d_${idx}_depthwise/depthwise_weights] to be a Tensor4D, instead have ${depthwise_conv_params.filters}`)
    }

    if (!isTensor1D(depthwise_conv_params.batch_norm_scale)) {
      throw new Error(`expected weightMap[MobilenetV1/Conv2d_${idx}_depthwise/BatchNorm/gamma] to be a Tensor1D, instead have ${depthwise_conv_params.batch_norm_scale}`)
    }

    if (!isTensor1D(depthwise_conv_params.batch_norm_offset)) {
      throw new Error(`expected weightMap[MobilenetV1/Conv2d_${idx}_depthwise/BatchNorm/beta] to be a Tensor1D, instead have ${depthwise_conv_params.batch_norm_offset}`)
    }

    if (!isTensor1D(depthwise_conv_params.batch_norm_mean)) {
      throw new Error(`expected weightMap[MobilenetV1/Conv2d_${idx}_depthwise/BatchNorm/moving_mean] to be a Tensor1D, instead have ${depthwise_conv_params.batch_norm_mean}`)
    }

    if (!isTensor1D(depthwise_conv_params.batch_norm_variance)) {
      throw new Error(`expected weightMap[MobilenetV1/Conv2d_${idx}_depthwise/BatchNorm/moving_variance] to be a Tensor1D, instead have ${depthwise_conv_params.batch_norm_variance}`)
    }

    return {
      depthwise_conv_params,
      pointwise_conv_params: extractPointwiseConvParams('MobilenetV1', idx)
    }
  }

  function extractMobilenetV1Params(): MobileNetV1.Params {
    return {
      conv_0_params: extractPointwiseConvParams('MobilenetV1', 0),
      conv_pair_params: Array(13).fill(0).map((_, i) => extractConvPairParams(i + 1))
    }
  }

  function extractBoxPredictorParams(idx: number): BoxPredictionParams {

    const params = {
      box_encoding_predictor_params: {
        filters: weightMap[`Prediction/BoxPredictor_${idx}/BoxEncodingPredictor/weights`],
        bias: weightMap[`Prediction/BoxPredictor_${idx}/BoxEncodingPredictor/biases`]
      },
      class_predictor_params: {
        filters: weightMap[`Prediction/BoxPredictor_${idx}/ClassPredictor/weights`],
        bias: weightMap[`Prediction/BoxPredictor_${idx}/ClassPredictor/biases`]
      }
    }

    if (!isTensor4D(params.box_encoding_predictor_params.filters)) {
      throw new Error(`expected weightMap[Prediction/BoxPredictor_${idx}/BoxEncodingPredictor/weights] to be a Tensor4D, instead have ${params.box_encoding_predictor_params.filters}`)
    }

    if (!isTensor1D(params.box_encoding_predictor_params.bias)) {
      throw new Error(`expected weightMap[Prediction/BoxPredictor_${idx}/BoxEncodingPredictor/biases] to be a Tensor1D, instead have ${params.box_encoding_predictor_params.bias}`)
    }

    if (!isTensor4D(params.class_predictor_params.filters)) {
      throw new Error(`expected weightMap[Prediction/BoxPredictor_${idx}/ClassPredictor/weights] to be a Tensor4D, instead have ${params.class_predictor_params.filters}`)
    }

    if (!isTensor1D(params.class_predictor_params.bias)) {
      throw new Error(`expected weightMap[Prediction/BoxPredictor_${idx}/ClassPredictor/biases] to be a Tensor1D, instead have ${params.class_predictor_params.bias}`)
    }

    return params
  }

  function extractPredictionLayerParams(): PredictionLayerParams {
    return {
      conv_0_params: extractPointwiseConvParams('Prediction', 0),
      conv_1_params: extractPointwiseConvParams('Prediction', 1),
      conv_2_params: extractPointwiseConvParams('Prediction', 2),
      conv_3_params: extractPointwiseConvParams('Prediction', 3),
      conv_4_params: extractPointwiseConvParams('Prediction', 4),
      conv_5_params: extractPointwiseConvParams('Prediction', 5),
      conv_6_params: extractPointwiseConvParams('Prediction', 6),
      conv_7_params: extractPointwiseConvParams('Prediction', 7),
      box_predictor_0_params: extractBoxPredictorParams(0),
      box_predictor_1_params: extractBoxPredictorParams(1),
      box_predictor_2_params: extractBoxPredictorParams(2),
      box_predictor_3_params: extractBoxPredictorParams(3),
      box_predictor_4_params: extractBoxPredictorParams(4),
      box_predictor_5_params: extractBoxPredictorParams(5)
    }
  }

  return {
    extractMobilenetV1Params,
    extractPredictionLayerParams
  }
}

export async function loadQuantizedParams(uri: string | undefined): Promise<any> {//Promise<NetParams> {
  const weightMap = await loadWeightMap(uri, DEFAULT_MODEL_NAME)

  const {
    extractMobilenetV1Params,
    extractPredictionLayerParams
  } = extractorsFactory(weightMap)

  const extra_dim = weightMap['Output/extra_dim']
  if (!isTensor3D(extra_dim)) {
    throw new Error(`expected weightMap['Output/extra_dim'] to be a Tensor3D, instead have ${extra_dim}`)
  }

  return {
    mobilenetv1_params: extractMobilenetV1Params(),
    prediction_layer_params: extractPredictionLayerParams(),
    output_layer_params: {
      extra_dim
    }
  }
}