// @flow

import { isExpressionFilter } from './index';

import type { FilterSpecification } from '../types';

type ExpectedTypes = {[string]: 'string' | 'number' | 'boolean'};

export default function convertFilter(filter: FilterSpecification, expectedTypes: ?ExpectedTypes): mixed {
    if (isExpressionFilter(filter)) { return filter; }

    if (!filter) return true;
    const op = filter[0];
    if (filter.length <= 1) return (op !== 'any');

    if (!expectedTypes) expectedTypes = {};

    let converted;

    if (
        op === '==' ||
        op === '!=' ||
        op === '<' ||
        op === '>' ||
        op === '<=' ||
        op === '>='
    ) {
        const [, property, value] = (filter: any);
        converted = convertComparisonOp(property, value, op, expectedTypes);
    } else if (op === 'any') {
        const children = (filter: any).slice(1).map(f => {
            const types = {};
            const child = convertFilter(f, types);
            const typechecks = runtimeTypeChecks(types);
            return typechecks === true ? child : ['case', typechecks, child, false];
        });
        return ['any'].concat(children);
    } else if (op === 'all') {
        const types = {};
        const children = (filter: any).slice(1).map(f => convertFilter(f, types));
        const expr = ['all'].concat(children);
        const typechecks = runtimeTypeChecks(types);
        return typechecks === true ? expr : [ 'case', typechecks, expr, false ];
    } else if (op === 'none') {
        const types = {};
        const children = (filter: any).slice(1).map(f => convertFilter(f, types));
        const expr = ['all'].concat(children.map(f => ['!', f]));
        const typechecks = runtimeTypeChecks(types);
        return typechecks === true ? expr : [ 'case', typechecks, expr, true ];
    } else if (op === 'in') {
        converted = convertInOp((filter[1]: any), filter.slice(2));
    } else if (op === '!in') {
        converted = convertInOp((filter[1]: any), filter.slice(2), true);
    } else if (op === 'has') {
        converted = convertHasOp((filter[1]: any));
    } else if (op === '!has') {
        converted = ['!', convertHasOp((filter[1]: any))];
    } else {
        converted = true;
    }

    return converted;
}

function runtimeTypeChecks(expectedTypes: ExpectedTypes) {
    const conditions = [];
    for (const property in expectedTypes) {
        const get = property === '$id' ? ['id'] : ['get', property];
        conditions.push(['==', ['typeof', get], expectedTypes[property]]);
    }
    if (conditions.length === 0) return true;
    return ['all'].concat(conditions);
}

function convertComparisonOp(property: string, value: any, op: string, expectedTypes: ExpectedTypes) {
    let get;
    switch (property) {
    case '$type':
        return [op, ['geometry-type'], value];
    case '$id':
        get = ['id'];
        break;
    default:
        get = ['get', property];
    }

    if (value !== null) {
        const type = ((typeof value): any);
        expectedTypes[property] = type;
    }

    if (op === '==' && property !== '$id' && value === null) {
        return [
            'all',
            ['has', property], // missing property != null for legacy filters
            ['==', get, null]
        ];
    } else if (op === '!=' && property !== '$id' && value === null) {
        return [
            'any',
            ['!', ['has', property]], // missing property != null for legacy filters
            ['!=', get, null]
        ];
    }

    return [op, get, value];
}

function convertInOp(property: string, values: Array<any>, negate = false) {
    if (values.length === 0) return negate;

    let get;
    switch (property) {
    case '$type':
        get = ['geometry-type'];
        break;
    case '$id':
        get = ['id'];
        break;
    default:
        get = ['get', property];
    }

    let uniformTypes = true;
    const type = typeof values[0];
    for (const value of values) {
        if (typeof value !== type) {
            uniformTypes = false;
            break;
        }
    }

    if (uniformTypes && (type === 'string' || type === 'number')) {
        return ['match', get, values, !negate, negate];
    }

    return [ negate ? 'all' : 'any' ].concat(
        values.map(v => [negate ? '!=' : '==', get, v])
    );
}

function convertHasOp(property: string) {
    switch (property) {
    case '$type':
        return true;
    case '$id':
        return ['!=', ['id'], null];
    default:
        return ['has', property];
    }
}
