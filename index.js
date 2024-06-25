// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadextension_settings[extensionName] from extensions.js
import { extension_settings, getContext } from "../../../extensions.js";

//You'll likely need to import some other functions from the main script
import {
  extension_prompt_types,
  event_types,
  eventSource,
  setExtensionPrompt,
  saveSettingsDebounced,
  updateMessageBlock
} from "../../../../script.js";

import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';

// Keep track of where your extension is located, name should match repo name
const extensionName = "st-render-charts";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
//settings

/**
 * Loads an external file (CSS or JS) into the document's head.
 *
 * @param {string} src - The source URL or path to the file to load.
 * @param {string} type - The type of file to load. Accepted values are "css" or "js".
 * @param {Function} [callback] - Optional callback function to execute once the file is loaded (used only for JS files).
 */
function loadFile(src, type, callback) {
    var elem;

    if (type === 'css') {
        elem = document.createElement('link');
        elem.rel = 'stylesheet';
        elem.href = src;
    } else if (type === 'js') {
        elem = document.createElement('script');
        elem.src = src;
        elem.onload = function () {
            if (callback) callback();
        };
    }

    if (elem) {
        document.head.appendChild(elem);
    }
}

loadFile(`https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js`, 'js');

const defaultPrompt = `<instructions>
**CHARTS**: You are given access to charts. To place a chart, follow the format and give a unique string to the canvas's id. Example:
\`\`\`
<div>
  <canvas id="[unique string here]"></canvas>
</div>
<chartData>
  {
    canvasId: '[unique string here]',
    type: 'bar',
    data: {
      labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
      datasets: [{
        label: '# of Votes',
        data: [12, 19, 3, 5, 2, 3],
        borderWidth: 1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  };
</chartData>
\`\`\`
This is an example. Any charts you implement should contain relevant information.
</instructions>`

const defaultSettings = {
  active: false,
  prompt: defaultPrompt,
};

// used to cancel the interval sending the prompt every second
let promptIntervalId

const chartRegex = /<chartData>(.+)<\/chartData>/s

async function renderCharts(messageId) {
  if (!extension_settings[extensionName].active) {
    return;
  }
  const context = getContext();
  const message = context.chat[messageId];

  // New swipe is being generated. Don't translate that
  if ($(`#chat .mes[mesid="${messageId}"] .mes_text`).text() == '...') {
      return;
  }

  const found = message.mes.match(chartRegex);
  if(!found) {
    return
  }
  let chartDataString = found[1].trim();
  console.log("Render Charts: ", "chartData: ", chartDataString);
  let chartData = new Function("return " + chartDataString + ";")();
  let id = chartData.canvasId;
  delete chartData.canvasId;
  let JQElement = $(`#${id}`);
  if(!JQElement) {
    console.log("Render Charts: ", "Data found, but no element.");
    return;
  }
  new Chart(JQElement.get(), chartData)

  message.mes = $(`#chat .mes[mesid="${messageId}"] .mes_text`).text()

  //updateMessageBlock(messageId, message);
}

function setChartActive(isActive) {
  extension_settings[extensionName].active = isActive
  if (isActive) {
    promptIntervalId = setInterval(updateInputs, 1000);
  } else {
    if (promptIntervalId) {
        clearInterval(promptIntervalId);
    }
  }
  updateInputs();
  saveSettingsDebounced();
}

function setupEvents() {
  eventSource.makeFirst(event_types.CHARACTER_MESSAGE_RENDERED, renderCharts);
  eventSource.on(event_types.MESSAGE_SWIPED, renderCharts);
}

function updateInputs() {
  if (extension_settings[extensionName].active) {
      setExtensionPrompt(extensionName.toUpperCase(), extension_settings[extensionName].active ? extension_settings[extensionName].prompt : "", extension_prompt_types.IN_CHAT, 0);
  }
}

function setupCommands() {
  SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'toggle-charts',
    callback: () => {
        setChartActive(!extension_settings[extensionName].active)
        toastr.info(
          `Charts is ${extension_settings[extensionName].active ? "enabled" : "disabled"}`
        );
        return extension_settings[extensionName].active
    },
    returns: 'charts is now enabled/disabled.',
    helpString: `
        <div>
            Toggle charts on or off. When enabled, extension injects the prompt and searches for attempts in the chat to declare a chart.
        </div>
    `,
  }));
}

function setupSettings() {
  extension_settings[extensionName] = extension_settings[extensionName] || {}
  for (const key in defaultSettings) {
    if (!Object.hasOwn(extension_settings[extensionName], key)) {
        extension_settings[extensionName][key] = defaultSettings[key];
        saveSettingsDebounced();
    }
  }
}

// This function is called when the extension is loaded
jQuery(async () => {
  setupSettings();
  setupEvents();
  setupCommands();
  setChartActive(extension_settings[extensionName].active);
  console.log("Render Charts: Charts Finished Loading");
});
