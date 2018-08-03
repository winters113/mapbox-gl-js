// @flow

export default drawCustom;

import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import {prepareOffscreenFramebuffer, drawOffscreenTexture} from './offscreen';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type CustomStyleLayer from '../style/style_layer/custom_style_layer';

function drawCustom(painter: Painter, sourceCache: SourceCache, layer: CustomStyleLayer) {

    const context = painter.context;
    const implementation = layer.implementation;

    if (painter.renderPass === 'offscreen') {

        if (implementation.prerender) {
            painter.setCustomLayerDefaults();

            implementation.prerender(context.gl, painter.transform.customLayerMatrix());

            context.setDirty();
            painter.setBaseState();
        }

        if (layer.implementation.render3D) {
            painter.setCustomLayerDefaults();

            prepareOffscreenFramebuffer(painter, layer);
            implementation.render3D(context.gl, painter.transform.customLayerMatrix());

            context.setDirty();
            painter.setBaseState();
        }

    } else if (painter.renderPass === 'translucent') {

        if (implementation.render) {

            painter.setCustomLayerDefaults();

            context.setStencilMode(StencilMode.disabled);
            context.setDepthMode(DepthMode.disabled);

            implementation.render(context.gl, painter.transform.customLayerMatrix());

            context.setDirty();
            painter.setBaseState();
            context.bindFramebuffer.set(null);
        }

        if (layer.implementation.render3D) {
            drawOffscreenTexture(painter, layer, 1);
        }
    }
}
