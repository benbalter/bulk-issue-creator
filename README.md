# GitHub bulk issue creator

Bulk opens batches of issues (or posts comments) across GitHub repositories based on a template and CSV of values. Think of it like "mail merge" for GitHub issues. It can be run locally, via Codespaces, or via GitHub Actions.

## How it works

1. You create a CSV of repositories where you'd like issues opened and any fill-in fields you'd like to include in the resulting issues. It might look something like this:
   ![Example CSV](https://user-images.githubusercontent.com/282759/115310271-86b3ba00-a13b-11eb-9fab-b5a7ac613c42.png)
2. You create a template of what you'd like to use as the basis for the resulting issue body. You can even reference those per-issue fill-in fields. If we wanted to reference the `name` field in the example above, it might look something like this:<br />
   ![Example template](https://user-images.githubusercontent.com/282759/115310395-c11d5700-a13b-11eb-91b5-e1b74beda70d.png)
3. You run the bulk issue creator script (either locally, via Codespaces, or via GitHub Actions - see below)
4. Customized issues (or comments) are created on your behalf for every row you defined in the CSV.
5. Profit! :tada:

## Running locally

1. `git clone https://github.com/benbalter/bulk-issue-creator`
2. `bulk-issue-creator init` to create a `./config/data.csv` and `./config/template.md.mustache` files
3. Follow [the "Setup" instructions below](#setup) to customize the data file and template.
4. Export the personal access token you create as the `GITHUB_TOKEN` environmental variable, or add it to a `.env` file in the root of the repository in the form of `GITHUB_TOKEN=XXX`.
5. Run `bulk-issue-creator` to preview the output
6. Run `bulk-issue-creator --write` to create the issues.

## Running via GitHub actions

Don't want to deal with the hassle of setting up a local Ruby environment? No worries. With a little copy/paste can use GitHub actions to open issues _from the cloud!_:

1. Create a new repository (public or private)
2. Follow [the "Setup" instructions below](#setup) to add the CSV and template to the repository.
3. If you'd like to open issues in a repository other than the one containing the action, store a personal access token you create as the `PERSONAL_ACCESS_TOKEN` [Actions Secret](https://docs.github.com/en/actions/reference/encrypted-secrets) within the repository settings
4. Create a `.github/workflows/bulk-issue-creator.yml` file with the following contents:

   ```yml
   on:
     workflow_dispatch:
       inputs:
         write:
           description: "Change to 'true' to create issues, leave as 'false' to preview output"
           default: "false"
           type: boolean

   name: Bulk issue creator

   jobs:
     bulk_issue_creator:
       runs-on: ubuntu-latest
       name: Bulk Issue Creator
       steps:
         - name: Checkout template and data
           uses: actions/checkout@v2
         - name: Create bulk issues
           uses: benbalter/bulk-issue-creator@v2
           with:
             write: ${{ github.event.inputs.write }}
             github_token: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
   ```

5. Navigate to `Actions` -> `Bulk issue creator` -> `Run Workflow` and click `Run Workflow` to preview the output.
   ![Workflow dispatch steps](https://user-images.githubusercontent.com/282759/115309898-e8bfef80-a13a-11eb-95c9-dccd8fc16108.png)

   Note: once you run the workflow, you can see the output by clicking `Bulk issue creator` in the side bar, and then clicking into the most recent run.

   ![Example preview output](https://user-images.githubusercontent.com/282759/115309886-e65d9580-a13a-11eb-8211-7db724c6127a.png)

6. Repeat step 5, changing the `false` text input to `true` in the final dialog to create issues.

## Setup

1. Run `bulk-issue-creator init` or manually create a CSV file in `./config/data.csv`. The CSV must have columns for `repository` and `title` (for issues) or `issue_number` (for comments). All field names are case sensitive. You can also add any other columns you would like, which will be available to the template. It should look something like this:
   ```csv
   repository,title,project,labels
   benbalter/gman,Update GMan,GMan,"Red,Blue"
   benbalter/jekyll-auth,Update Jekyll Auth,Jekyll Auth,"Green,Blue"
   ```
2. Edit (or create) the `./config/template.md.mustache` file in the same directory with the content you want in the issue body. You can reference CSV fields like `{{project}}` using the [Mustache syntax](https://mustache.github.io/mustache.5.html). It should look something like this:
   ```mustache
   Hey there! It looks like it's time to update {{project}}!
   ```
3. [Create a personal access token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token) with `repo` scope.

### Templating

Templates (and issue titles) support the [Mustache syntax](https://mustache.github.io/mustache.5.html). Field names in the CSV should be lower case, and should use `_`s to separate multiple words `like_this`, instead of spaces.

### Advanced usage

#### Optional arguments

Options can be passed as command-line arguments when running locally or via the `with:` property of GitHub Actions. Both locally and when running via GitHub actions, options can also be passed via environment variables. See the table below for available options and how to pass them:

<!-- Options here -->

| Command-line                    | GitHub Actions `with:`         | GitHub Actions `env:` (or `.env` file) | Description                                      |
| ------------------------------- | ------------------------------ | -------------------------------------- | ------------------------------------------------ |
| `--write`                       | `write: true`                  | `WRITE: true`                          | Write issues to GitHub, defaults to preview only |
| `--comment`                     | `comment: true`                | `COMMENT: true`                        | Create comments instead of issues                |
| `--template-path=TEMPLATE_PATH` | `template_path: TEMPLATE_PATH` | `TEMPLATE_PATH: TEMPLATE_PATH`         | Path to the template file                        |
| `--csv-path=CSV_PATH`           | `csv_path: CSV_PATH`           | `CSV_PATH: CSV_PATH`                   | Path to the CSV file                             |
| `--github-token=GITHUB_TOKEN`   | `github_token: GITHUB_TOKEN`   | `GITHUB_TOKEN: GITHUB_TOKEN`           | GitHub Token for authenticating with GitHub      |
| `--liquid`                      | `liquid: true`                 | `LIQUID: true`                         | Use Liquid templating instead of Mustache        |

#### Special fields

- You can add a `labels` or `assignees` column to the CSV, with a comma-separated list of labels or assignees that you'd like added to the issue.
- You can add an `issue_number` column to the CSV, with the issue number you'd like the comment added to. Note: You must pass the `--comment` flag

#### Adding issues to a project board

If you'd like to add created issues to a project board, I suggest adding a specific label and using [`actions/add-to-project`](https://github.com/actions/add-to-project) to add the issue to the project board.
