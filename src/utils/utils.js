import React from 'react';

import { isArray } from 'underscore';
import csv2geojson from 'csv2geojson';
import { ascending } from 'd3-array';
import html2canvas from 'html2canvas';

import qs from 'qs'; // importing it other ways would cause minification issue.

import mapping from '../location-icon-mapping.json';
import Constants from '../Constants';
import {
  isString, isNumber, isObject, randomToNumber, isStringNumeric,
  isNullUndefinedNaN
} from './JSUtils.js';
import IconClusterLayer from '../icon-cluster-layer';
import atlas from '../img/location-icon-atlas.png';
import { sfType } from './geojsonutils';
import { getLayerProps } from '../components/settings/settingsUtils';
import history from '../history';

const { DateTime } = require("luxon");

const fetchData = (url, callback) => {
  fetch(url) //
    .then((response) => response.text())
    .then((response) => {
      // TODO: better checks for both
      // zip and csv
      if (isString(url) && url.endsWith("zip")) {
        /* global shp */
        if (typeof shp === 'function') {
          shp(url).then(geojson => {
            typeof callback === "function"
              && callback(geojson)
          });
        } else {
          callback(undefined, new Error(
            url + "Function 'shp' is not in context."
          ))
        }
      } else if (isString(url) && url.endsWith("csv")) {
        csv2geojson.csv2geojson(response, (err, data) => {
          if (!err) {
            typeof (callback) === 'function'
              && callback(data)
          }
        })
      } else {
        //assume json
        try {
          const json = JSON.parse(response);
          callback(json)
        } catch (error) {
          callback(undefined, error)
        }
      }
    })
    .catch((error) => {
      console.error(error);
      callback(null, error)
    });

}

/**
 *
 * Simple fetch check of URL
 *
 * @param {*} URL
 * @param {*} callback
 */
const checkURLReachable = (URL, callback) => {
  fetch(URL)
    .then((response) => {
      if (response.ok) {
        callback(true)
      } else {
        callback(false)
      }
    })
    .catch((error) => {
      console.log('There has been a problem with your fetch operation: ' + error.message);
    });
}

/**
 * Function to count frequency of values of `property` given.
 *
 * TODO: Double check to see if it is slightly different
 * version of propertyCount
 *
 * TODO: move to geojsonutils
 *
 * @param {Object} data
 * @param {String} property
 * @param {Boolean} noNulls
 */
const xyObjectByProperty = (data, property, noNulls = true) => {
  if (!data || !property) return;
  //data = [{...data = 12/12/12}]
  // console.log(data);
  const map = new Map()
  data.forEach(feature => {
    let value = feature.properties[property];
    if (noNulls && isNullUndefinedNaN(value)) { // remove nulls here
      return
    }
    // some disagree with even this
    value = isStringNumeric(value) ? +(value) : value
    if (map.get(value)) {
      map.set(value, map.get(value) + 1)
    } else {
      map.set(value, 1)
    }
  });

  const sortedArray = Array.from(map.keys());

  if (!sortedArray || !sortedArray.length) return;
  sortedArray.sort(ascending)

  return sortedArray.map(key => {
    return (
      {
        x: key,
        y: +(map.get(key))
      }
    )
  })
}


const generateDeckLayer = (name, data, renderTooltip, options) => {
  const addOptionsToObject = (opt, obj) => {
    Object.keys(opt).forEach(key =>
      obj[key] = opt[key]
    )
  }

  /**
  * @param {String} name passed down from generateDeckLayer
  * @param {Object} data passed down from generateDeckLayer
  * @param {Object} renderTooltip passed down from generateDeckLayer
  * @returns
  */
  function generateOptions(name, data, renderTooltip) {
    const layerProps = getLayerProps(name);
    if (!layerProps || !layerProps.class || !layerProps.class["value"]) return null
    const layerOptions = {}, updateTriggers = {};
    Object.keys(layerProps).forEach(key => {
      const type = layerProps[key] && layerProps[key].type;
      if (type === 'number' || type === 'column') {
        layerOptions[key] = layerProps[key].default;
        // TODO: generalize updateTriggers using the layerProps
        // only properties with type "column"
        // odd fill colour etc can be added.
        if (type === 'column' && typeof options[key] === 'function') {
          updateTriggers[key] =
            typeof (options[key]) === 'function'
            && data.map(d => options[key](d))
        }
      } else if (type === 'boolean' || type === 'class') {
        layerOptions[key] = layerProps[key].value;
      } else {
        // such as default functions defined for layers
        layerOptions[key] = layerProps[key]
      }
    });
    // common properties
    layerOptions.data = data;
    layerOptions.id = name + "-layer";
    layerOptions.onHover = renderTooltip;
    layerOptions.getPosition = d => d.geometry.coordinates;
    // (source, target) vs Object.assign(target, source)
    addOptionsToObject(options, layerOptions)
    layerOptions.updateTriggers = {
      ...layerOptions.updateTriggers, ...updateTriggers
    }
    return new layerProps.class["value"](layerOptions);
  }

  if (name === 'icon') {
    /**
     * There are three files the layer need to display the icons:
     * (1) location-icon-atlas.png which is in /public
     * (2) ./location-icon-mapping.json which deals with mapping the icon to pixels on (1)
     * (3) ./icon-cluster-layer.json which is a DeckGL CompositLayer component that
     * does the clustering.
     */
    //icon from https://github.com/uber/deck.gl/blob/8d5b4df9e4ad41eaa1d06240c5fddb922576ee21/website/src/static/images/icon-atlas.png
    const iconObj = {
      id: 'icon-layer',
      data,
      pickable: true,
      iconAtlas: atlas,
      iconMapping: mapping,
      sizeScale: 60,
      getPosition: d => d.geometry.coordinates,
      wrapLongitude: true,
      // getIcon: d => 'marker-1',
      // getSize: d => 5,
      // getColor: d => [Math.sqrt(d.exits), 140, 0],
      onHover: renderTooltip
    }
    addOptionsToObject(options, iconObj)
    return (new IconClusterLayer(iconObj))
  }

  return generateOptions(name, data, renderTooltip)
}

const convertRange = (oldValue = 2, values =
  { oldMax: 10, oldMin: 1, newMax: 1, newMin: 0 }) => {
  const value = (((oldValue - values.oldMin) * (values.newMax - values.newMin))
    / (values.oldMax - values.oldMin)) + values.newMin
  return +(value.toFixed(2))
}

const getViewportParams = (search) => {
  if (typeof search !== 'string' || !search) return (null);

  const qsResult = qs.parse(search.replace("?", ""))
  // 3 decimal points is street level
  const lat = Number(qsResult.lat).toFixed(3);
  const lng = Number(qsResult.lng).toFixed(3);
  return ({
    latitude: !isNaN(lat) ? Number(lat) : 53.8321,
    longitude: !isNaN(lng) ? Number(lng) : -1.6362,
    zoom: Number(qs.parse(search).zoom) || 10,
    pit: Number(qs.parse(search).pit) || 55,
    bea: Number(qs.parse(search).bea) || 0,
    alt: Number(qs.parse(search).alt) || 1.5,
  })
};

const getBbx = (bounds) => {
  if (!bounds) return null;
  // xmin = -1.6449
  // ymin = 53.82925
  // xmax = -1.6270
  // ymax = 53.8389
  let xmin = bounds._sw.lng;
  let xmax = bounds._ne.lng;
  let ymin = bounds._sw.lat;
  let ymax = bounds._ne.lat;
  if (xmin > xmax) {
    xmax = bounds._sw.lng;
    xmin = bounds._ne.lng;
  }
  if (ymin > ymax) {
    ymax = bounds._sw.lat;
    ymin = bounds._ne.lat;
  }
  return ({ xmin, ymin, xmax, ymax })
}

/**
 * Current version simply picks up a feature out of
 * array of features, compares it to the available
 * list of DeckGL layers supported by TGVE
 * and returns one of them.
 *
 * @param {Array} features
 * @returns
 */
const suggestDeckLayer = (features) => {
  const r = randomToNumber(features && features.length)
  if (!features || !features[r].geometry ||
    !features[r].geometry.type) return null
  // basic version should suggest a layer based
  // on a simple check of a random geometry type from
  // array of features
  // TODO: go through each feature? in case of features.
  const type = sfType(features[r]);
  if (new RegExp("point", 'i').test(type)) {
    return "grid"
  } else if (new RegExp("line", 'i').test(type)) {
    return "line"
  } else {
    return "geojson"
  }

}
const suggestUIforNumber = (number) => {
  // "checkbox",
  // "radio",
  // "buttongroups",
  // "dropdown",
  // "slider"])
  const { UI_LIST } = Constants;
  if (!number) return UI_LIST[1];
  if (number === 1) {
    return UI_LIST[0];
  } else if (number > 3 && number <= 6) {
    return UI_LIST[1];
  } else if (number === 2 || number === 3) {
    return UI_LIST[2];
  } else if (number > 9 && number < 15) {
    return UI_LIST[3];
  } else {
    return UI_LIST[4]; // slider
  }
}

/**
 * Changes a `_` separated `str` to space separated and
 * camel cases all words
 *
 * @param {*} str
 */
const humanize = (str) => {
  if (!isString(str)) return str
  let frags = str.split('_');
  for (let i = 0; i < frags.length; i++) {
    frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
  }
  return frags.join(' ');
}

const shortenName = (name, n = 26) => {
  if (isNumber(name)) {
    return parseFloat(Number.parseFloat(name).toFixed(2).toString())
  }
  if (!name || name.length <= n || !isString(name)) return name;
  let shortened = name.trim();
  const extension = name.split('.').length > 1 &&
    name.split('.').pop().length < 10 && name.split('.').pop();
  shortened.replace(extension, "");
  if (name.length > 10) {
    shortened = shortened.substring(0, 10) + "..." + (extension || "")
  }
  return (shortened);
}

const firstLastNCharacters = (str, n = 5) => {
  if (+str || !str) return str;
  return str.slice(0, n) + (str.length > n + n ?
    "..." + str.slice(str.length - n, str.length) :
    str.length > n ? "..." : "")
}

const percentDiv = (title, left, cb, dark, percent = '30%') => {
  return (
    <div
      key={title}
      onClick={() => typeof (cb) === 'function' && cb()}
      style={{
        cursor: 'pointer',
        textAlign: 'center',
        position: 'relative',
        float: 'left',
        width: percent,
        color: dark ? 'white' : 'black',
        margin: '10px 2px',
        border: '1px solid gray',
      }}>
      <span style={{ position: 'absolute', left: '10%' }}>
        {title}
      </span>
      <div style={{
        width: left + '%',
        height: 20,
        background: 'rgb(18, 147, 154)',
        // background: 'rgb(200, 120, 0)'
      }}>
      </div>
    </div>
  )
}

if (!Array.prototype.flat) {
  // eslint-disable-next-line no-extend-native
  Object.defineProperty(Array.prototype, 'flat', {
    value: function (depth = 1) {
      return this.reduce(function (flat, toFlatten) {
        return flat.concat((Array.isArray(toFlatten) && (depth > 1)) ? toFlatten.flat(depth - 1) : toFlatten);
      }, []);
    }
  });
}
const ll = ["http://localhost", "http://127.0.0.1"]
const devURLS = ll.map(lh => [lh, lh + ":8080", lh + ":8000",
  lh + ":5000", lh + ":3000"]).flat()
const urlRegex = new RegExp(
  "^" +
  // protocol identifier (optional)
  // short syntax // still required
  "(?:(?:(?:https?|ftp):)?\\/\\/)" +
  // user:pass BasicAuth (optional)
  "(?:\\S+(?::\\S*)?@)?" +
  "(?:" +
  // IP address exclusion
  // private & local networks
  "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
  "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
  "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
  // IP address dotted notation octets
  // excludes loopback network 0.0.0.0
  // excludes reserved space >= 224.0.0.0
  // excludes network & broadcast addresses
  // (first & last IP address of each class)
  "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
  "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
  "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
  "|" +
  // host & domain names, may end with dot
  // can be replaced by a shortest alternative
  // (?![-_])(?:[-\\w\\u00a1-\\uffff]{0,63}[^-_]\\.)+
  "(?:" +
  "(?:" +
  "[a-z0-9\\u00a1-\\uffff]" +
  "[a-z0-9\\u00a1-\\uffff_-]{0,62}" +
  ")?" +
  "[a-z0-9\\u00a1-\\uffff]\\." +
  ")+" +
  // TLD identifier name, may end with dot
  // TGVE edit: remove requirement of TLD
  "(?:[a-z\\u00a1-\\uffff]{2,}\\.?)?" +
  ")" +
  // port number (optional)
  "(?::\\d{2,5})?" +
  // resource path (optional)
  "(?:[/?#]\\S*)?" +
  "$", "i"
);
/**
 * TGVE should do a basic check and suffice.
 * Even this is too much.
 *
 * Thanks to https://gist.github.com/dperini/729294
 * @param {*} str
 */
const isURL = (str) => {
  if (!isString(str)) return false;
  if (devURLS.some(e => str.startsWith(e))) return true
  return urlRegex.test(str)
}

const isMobile = function () {
  var check = false;
  if (window.innerWidth < 640) return true;
  (function (a) { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(a.substr(0, 4))) check = true; })(navigator.userAgent || navigator.vendor || window.opera);
  return check;
};

const iconJSType = (dataType) => {
  // describeFeatureVariables in geojsonutils
  // String, Number, Boolean and Object
  if (!dataType) return (null)
  switch (dataType) {
    case "String":
      dataType = "fa fa-globe";
      break;
    case "Number":
      dataType = "fa fa-list";
      break;
    case "Object":
      dataType = "fa fa-sack";
      break;
    default:
      dataType = "fa fa-question-circle";
  }
  return dataType
}

/**
 *
 * @param {*} data features from a geojson object
 * @param {*} column
 */
const generateDomain = (data, column) => {
  // TODO: if column === 0 it should be valid
  if (!data || !Array.isArray(data) || !column || !data.length) return;
  let domainIsNumeric = true;
  let domain = [];
  data.forEach(feature => {
    // uber move to show isochrones
    const i = feature.properties[
      +(column) ? Object.keys(feature.properties)[column] : column
    ]; // eliminate nulls
    if (!i) return;
    if (+(i) &&
      column === 'Mean.Travel.Time..Seconds.') {
      domain.push(Math.floor(i / 300));
    } else {
      if (+(i)) {
        domain.push(+(i))
      } else {
        domainIsNumeric = false;
        domain.push(i)
      }
    }
  });
  domain = Array.from(new Set(domain));
  // sort the domain if possible
  if (domainIsNumeric) {
    domain = domain.sort((a, b) => { return (a - b); });
  }
  return domain
}

const sortNumericArray = (array) => {
  let domainIsNumeric = true;
  // sort the domain if possible
  array.map(e => !isNumber(e) && (domainIsNumeric = false))
  if (domainIsNumeric) {
    array = array.sort((a, b) => { return (a - b); });
  }
  return array
}

const getMax = (arr) => {
  return arr.reduce((max, v) => max >= v ? max : v, -Infinity);
}
const getMin = (arr) => {
  return arr.reduce((max, v) => max <= v ? max : v, Infinity);
}

const getOSMTiles = (name) => {
  const TILES = {
    OSM: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    OSMB: "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
    TONER: "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.{ext}",
    STADIA: 'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.{ext}'
  }
  return ({
    "version": 8,
    "sources": {
      "simple-tiles": {
        "type": "raster",
        "tiles": [
          TILES[name] || TILES["OSM"]
        ],
        "tileSize": 256
      }
    },
    "layers": [{
      "id": "simple-tiles",
      "type": "raster",
      "source": "simple-tiles",
    }]
  });
}

/**
 *
 * @param {Object} obj Object with keys to compare keys to
 * regex
 *
 * @returns first key in the objec that matches the regex
 */
const getFirstDateColumnName = (obj) => {
  if (!isObject(obj) || !Object.keys(obj)) return null
  // find the date/time column with year in
  const r = new RegExp(Constants.DATE_REGEX);
  return Object.keys(obj).filter(e => r.test(e))[0]
}

const theme = (dark) => {
  return ({
    color: dark ? "white" : "black",
    background: dark ? "#242730" : "white"
  })
}

const isStringDate = (value) => {
  return DateTime.fromFormat(value + '', 'MMMM dd yyyy').isValid ||
    DateTime.fromFormat(value + '', 'MMMM d yyyy').isValid ||
    DateTime.fromFormat(value + '', 'MMM d yyyy').isValid ||
    DateTime.fromFormat(value + '', 'MMM dd yyyy').isValid ||
    DateTime.fromFormat(value + '', 'dd/MM/yyyy').isValid ||
    DateTime.fromFormat(value + '', 'dd-MM-yyyy').isValid ||
    DateTime.fromFormat(value + '', 'yyyy/mm/dd').isValid ||
    DateTime.fromFormat(value + '', 'yyyy-mm-dd').isValid ||
    DateTime.fromISO(value).isValid || // "19-2-1999"
    DateTime.fromHTTP(value).isValid ||
    (typeof value === Number && DateTime.fromMillis(value).isValid);
}

const arrayCardinality = (array) => {
  if (!Array.isArray(array) || !array.length) return null
  //
  return (Array.from(new Set(array)).length)
}

const uniqueValuePercentage = (array, test = 60) => {
  // simple logic: over limit is unique
  const cardinality = arrayCardinality(array)
  if (!cardinality && cardinality !== 0) return null
  return cardinality / array.length * 100 > test;
}

/**
 * Gently update browser history using a DeckGL/mapbox
 * viewport object and an api object (both spread and merged).
 *
 * @param {*} urlVars
 * @returns
 */
const updateHistory = (urlVars) => {
  if (!urlVars) return;
  // construct the search string
  let search = "?";
  // TODO: could be exported from const etc
  let apis = ["defaultURL", "geographyURL", "geographyColumn"]
  Object.keys(urlVars).forEach(k => {
    if (k === "latitude") {
      search += `lat=${urlVars[k].toFixed(3)}&`
    } else if (k === "longitude") {
      search += `lng=${urlVars[k].toFixed(3)}&`
    } else if (k === "zoom") {
      search += `${k}=${urlVars[k].toFixed(2)}&`
    } else if ((k === "bearing") || (k === "pitch") || (k === "altitude")) {
      search += `${k.substring(0, 3)}=${urlVars[k]}&`
    } else if (apis.includes(k) && isString(urlVars[k])) {
      search += `${k}=${urlVars[k]}&`
    }
  })
  // remove the trailing '&'
  search = search.slice(0, -1);
  // construct the entry for the history
  const entry = {
    pathname: history.location.pathname,
    search
  };
  !history.location.search ?
    // there is at least one service which behaves this way
    history.push(entry) : history.replace(entry);
}

/**
 * Basic version of saving a screenshot of TGVE.
 *
 * @param {*} map mapbox instance fully loaded
 * @param {*} deck deckgl current instance
 * @param {*} includeBody include TGVE sidebar/legend etc, default `true`
 * @param {function} callback returns the canvas based on params
 * @returns
 */
const screenshot = (map, deck, includeBody = true, callback) => {
  const fileName = "tgve-screenshot.png";
  // console.log(map, deck);
  if (!map || !deck) {
    return;
  }
  const mapboxCanvas = map.getCanvas();
  deck.redraw(true);
  const deckglCanvas = deck.canvas;
  // console.log(mapboxCanvas, deckglCanvas)
  const canvas = document.createElement("canvas");
  canvas.width = mapboxCanvas.width;
  canvas.height = mapboxCanvas.height;

  const context = canvas.getContext("2d");

  context.globalAlpha = 1.0;
  context.drawImage(mapboxCanvas, 0, 0);
  context.globalAlpha = 1.0;
  context.drawImage(deckglCanvas, 0, 0);
  if (!includeBody) {
    if (typeof callback === 'function') {
      callback(canvas, fileName);
      return
    }
    saveCanvas(canvas, fileName)
  } else {
    html2canvas(document.body).then((htmlCanvas) => {
      context.drawImage(htmlCanvas, 0, 0)
      if (typeof callback === 'function') {
        callback(canvas, fileName);
        return
      }
      saveCanvas(canvas, fileName);
    });
  }
  // window.location.href = image; // it will save locally
}

const saveCanvas = (canvas, fileName) => {
  const image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
  var link = document.createElement('a');
  link.download = fileName;
  link.href = image;
  link.click();
}

const iWithFaName = (faName, onClick, style, title) => <i
  style={Object.assign({
    margin: 5,
    cursor: 'pointer',
    fontSize: '1.5em'
  }, style)}
  onClick={onClick}
  className={faName || "fa fa-info"}
  title={title}></i>

const isArrayNumeric = (array) => {
  if (!isArray(array)) return null
  let isNumeric = true;
  array.forEach(e => {
    if (!isNumber(e)) {
      isNumeric = false
    }
  });
  return isNumeric
}

export {
  getFirstDateColumnName,
  uniqueValuePercentage,
  firstLastNCharacters,
  xyObjectByProperty,
  suggestUIforNumber,
  getViewportParams,
  generateDeckLayer,
  checkURLReachable,
  suggestDeckLayer,
  sortNumericArray,
  generateDomain,
  isArrayNumeric,
  updateHistory,
  convertRange,
  isStringDate,
  shortenName,
  iWithFaName,
  getOSMTiles,
  screenshot,
  percentDiv,
  iconJSType,
  fetchData,
  humanize,
  isMobile,
  getBbx,
  getMin,
  getMax,
  theme,
  isURL,
}
