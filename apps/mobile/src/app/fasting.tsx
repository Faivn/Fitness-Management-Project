import { Redirect } from 'expo-router';

/** Fasting now lives on the Meal plan page (second slide); old links land there. */
export default function Fasting() {
  return <Redirect href="/meals?page=fasting" />;
}
