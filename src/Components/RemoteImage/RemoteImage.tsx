import React from 'react';
import { Image, type ImageProps, type ImageSourcePropType } from 'react-native';
import FastImage, { type FastImageProps } from 'react-native-fast-image';

type RemoteImageProps = Omit<ImageProps, 'source'> & {
  source: ImageSourcePropType;
};

function isRemoteSource(source: ImageSourcePropType): source is { uri: string } {
  return (
    typeof source === 'object' &&
    source !== null &&
    'uri' in source &&
    typeof (source as { uri?: unknown }).uri === 'string' &&
    Boolean((source as { uri: string }).uri)
  );
}

/**
 * Uses FastImage for remote URIs; falls back to RN Image for local assets.
 */
const RemoteImage: React.FC<RemoteImageProps> = ({ source, style, resizeMode, ...rest }) => {
  if (isRemoteSource(source)) {
    const fastResize =
      resizeMode === 'contain'
        ? FastImage.resizeMode.contain
        : resizeMode === 'stretch'
          ? FastImage.resizeMode.stretch
          : resizeMode === 'center'
            ? FastImage.resizeMode.center
            : FastImage.resizeMode.cover;

    return (
      <FastImage
        source={{ uri: source.uri }}
        style={style as FastImageProps['style']}
        resizeMode={fastResize}
      />
    );
  }

  return <Image source={source} style={style} resizeMode={resizeMode} {...rest} />;
};

export default React.memo(RemoteImage);
