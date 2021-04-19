# GitHub bulk issue creator

Bulk opens batches of issues across GitHub repositories based on a template and CSV of values. Think of it like "mail merge" for GitHub issues.

## Running locally

1. Clone this repository locally
2. Follow [the "Setup" instructions below](#setup) to add the CSV and template to the repository.
3. Export the personal access token you create as the `GITHUB_TOKEN` environmental variable, or add it to a `.env` file in the root of the repository.
4. Run `bundle exec bulk-issue-creator.rb` to preview the output
5. Run `WRITE=true bundle exec bulk-issue-creator.rb` to create the issues.

## Running via GitHub actions

Don't want to deal with the hassle of setting up a local Ruby environment? No worries. With a little copy/paste can use GitHub actions to open issues *from the cloud!*:

1. Create a new repository (public or private)
2. Follow [the "Setup" instructions below](#setup) to add the CSV and template to the repository.
3. Store the personal access token you create as the `PERSONAL_ACCESS_TOKEN` [Actions Secret](https://docs.github.com/en/actions/reference/encrypted-secrets) within the repository settings
4. Create a `.github/workflows/bulk-issue-creator.yml` file with the following contents:
    ```yml
    on: 
      workflow_dispatch:
        inputs:
          write:
            description: "Change to 'true' to create issues, leaave as 'false' to preview output"
            default: "false"

    name: Bulk issue creator

    jobs:
      bulk_issue_creator:
        runs-on: ubuntu-latest
        name: Bulk Issue Creator
        steps:
          - name: Checkout template and data
            uses: actions/checkout@v2
          - name: Create bulk issues
            uses: benbalter/bulk-issue-creator@main
            env:
              GITHUB_TOKEN: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
              WRITE: ${{ github.event.inputs.write }}
    ```
5. Navigate to `Actions` -> `Bulk issue creator` -> `Run Workflow` and click `Run Workflow` to preview the output. 
    ![Workflow dispatch steps](https://user-images.githubusercontent.com/282759/115309898-e8bfef80-a13a-11eb-95c9-dccd8fc16108.png")

    Note: once you run the workflow, you can see the output by clicking `Bulk issue creator` in the side bar, and then clicking into the most recent run.

    ![Example preview output](https://user-images.githubusercontent.com/282759/115309886-e65d9580-a13a-11eb-8211-7db724c6127a.png)
6. Repeat step 5, changing the `write` value to `true` in the final dialog to create issues.

## Setup

1. Create a CSV file in `./config/data.csv`. The CSV must have columns for `repository` and `title`. It can optionally have a `labels` column, with a comma-separated list of labels you'd like added to the issue. You can also add any other columns you would like, which will be available to the template. It should look something like this:
    ```csv
    repository,title,project,labels
    benbalter/gman,Update GMan,GMan,"Red,Blue"
    benbalter/jekyll-auth,Update Jekyll Auth,Jekyll Auth,"Green,Blue"
    ```
2. Create a `./config/template.md.mustache` file in the same directory with the content you want in the issue body. You can reference CSV fields like `{{project}}` using the [Mustache syntax](https://mustache.github.io/mustache.5.html). It should look something like this:
    ```mustache
    Hey there! It looks like it's time to update {{project}}!
    ```
3. [Create a personal access token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token) with `repo` scope.
   

### Advanced setup

* You can customize the source mustache template and CSV path by setting the `TEMPLATE_PATH` and `CSV_PATH` environmental variables.
* Prefer to post a comment to an existing issue? Instead of the `title` column, add an `issue_number` column to your CSV with the issue's number (from the URL or next to the issue title) and pass the `COMMENT=true` environmental variable.

### Development status

Alpha - use at your own risk.