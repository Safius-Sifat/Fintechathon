// Secure random for key generation; must load before any wallet code.
import "react-native-get-random-values";
import { registerRootComponent } from "expo";
import App from "./App";
registerRootComponent(App);
